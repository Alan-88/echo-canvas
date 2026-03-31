use std::collections::HashSet;

use indexmap::IndexMap;
use whiteboard_shared::{Action, ShapeData};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ResourceInventoryStats {
    pub total_resources: usize,
    pub unique_resources: usize,
    pub total_resource_bytes: usize,
    pub unique_resource_bytes: usize,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct InlineResourcePayloadStats {
    pub total_payloads: usize,
    pub total_payload_bytes: usize,
}

#[derive(Debug, Default)]
pub struct ResourceInventoryCollector {
    stats: ResourceInventoryStats,
    unique_payloads: HashSet<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceKind {
    ImageSrc,
    MarkdownRenderedImage,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResourceCatalogEntry {
    pub id: String,
    pub kind: ResourceKind,
    pub mime_type: Option<String>,
    pub byte_length: usize,
    pub data_url: String,
}

fn estimate_data_url_payload_bytes(data_url: &str) -> usize {
    let Some((_, payload)) = data_url.split_once(',') else {
        return data_url.len();
    };

    let trimmed = payload.trim();
    if trimmed.is_empty() {
        return 0;
    }

    let padding = trimmed
        .as_bytes()
        .iter()
        .rev()
        .take_while(|byte| **byte == b'=')
        .count();

    (trimmed.len() / 4) * 3 - padding
}

fn shape_inline_resource(shape: &ShapeData) -> Option<&str> {
    match shape {
        ShapeData::Image { src, .. } if !src.is_empty() => Some(src.as_str()),
        ShapeData::Markdown { rendered_image, .. } if !rendered_image.is_empty() => {
            Some(rendered_image.as_str())
        }
        _ => None,
    }
}

fn add_shape_payload_stats(stats: &mut InlineResourcePayloadStats, shape: &ShapeData) {
    let Some(resource) = shape_inline_resource(shape) else {
        return;
    };

    stats.total_payloads += 1;
    stats.total_payload_bytes += estimate_data_url_payload_bytes(resource);
}

fn shape_inline_resource_with_kind(shape: &ShapeData) -> Option<(ResourceKind, &str)> {
    match shape {
        ShapeData::Image { src, .. } if !src.is_empty() => {
            Some((ResourceKind::ImageSrc, src.as_str()))
        }
        ShapeData::Markdown { rendered_image, .. } if !rendered_image.is_empty() => {
            Some((ResourceKind::MarkdownRenderedImage, rendered_image.as_str()))
        }
        _ => None,
    }
}

fn insert_shape_resource_into_catalog(
    catalog: &mut IndexMap<String, ResourceCatalogEntry>,
    shape: &ShapeData,
) {
    let Some((kind, data_url)) = shape_inline_resource_with_kind(shape) else {
        return;
    };

    let id = build_resource_id(kind, data_url);
    catalog
        .entry(id.clone())
        .or_insert_with(|| ResourceCatalogEntry {
            id,
            kind,
            mime_type: infer_data_url_mime_type(data_url),
            byte_length: estimate_data_url_payload_bytes(data_url),
            data_url: data_url.to_string(),
        });
}

fn infer_data_url_mime_type(data_url: &str) -> Option<String> {
    let header = data_url.split_once(',')?.0;
    let mime = header.strip_prefix("data:")?.split(';').next()?.trim();
    if mime.is_empty() {
        None
    } else {
        Some(mime.to_string())
    }
}

pub fn build_resource_id(kind: ResourceKind, data_url: &str) -> String {
    let kind_tag = match kind {
        ResourceKind::ImageSrc => "image-src",
        ResourceKind::MarkdownRenderedImage => "markdown-rendered-image",
    };
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in format!("{kind_tag}:{data_url}").as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{kind_tag}-{hash:016x}")
}

impl ResourceInventoryCollector {
    pub fn add_shape(&mut self, shape: &ShapeData) {
        let Some(resource) = shape_inline_resource(shape) else {
            return;
        };

        let bytes = estimate_data_url_payload_bytes(resource);
        self.stats.total_resources += 1;
        self.stats.total_resource_bytes += bytes;

        if self.unique_payloads.insert(resource.to_string()) {
            self.stats.unique_resources += 1;
            self.stats.unique_resource_bytes += bytes;
        }
    }

    pub fn into_stats(self) -> ResourceInventoryStats {
        self.stats
    }
}

#[cfg(test)]
pub fn collect_resource_catalog<'a, I>(shapes: I) -> IndexMap<String, ResourceCatalogEntry>
where
    I: IntoIterator<Item = &'a ShapeData>,
{
    let mut catalog = IndexMap::<String, ResourceCatalogEntry>::new();

    for shape in shapes {
        insert_shape_resource_into_catalog(&mut catalog, shape);
    }

    catalog
}

pub fn collect_action_resource_catalog<'a, I>(actions: I) -> IndexMap<String, ResourceCatalogEntry>
where
    I: IntoIterator<Item = &'a Action>,
{
    let mut catalog = IndexMap::<String, ResourceCatalogEntry>::new();

    for action in actions {
        match action {
            Action::Draw { shape, .. } => {
                insert_shape_resource_into_catalog(&mut catalog, shape);
            }
            Action::Update {
                old_shape,
                new_shape,
                ..
            } => {
                insert_shape_resource_into_catalog(&mut catalog, old_shape);
                insert_shape_resource_into_catalog(&mut catalog, new_shape);
            }
            Action::BatchUpdate { updates } => {
                for update in updates {
                    insert_shape_resource_into_catalog(&mut catalog, &update.old_shape);
                    insert_shape_resource_into_catalog(&mut catalog, &update.new_shape);
                }
            }
            _ => {}
        }
    }

    catalog
}

pub fn collect_action_inline_resource_payload_stats<'a, I>(actions: I) -> InlineResourcePayloadStats
where
    I: IntoIterator<Item = &'a Action>,
{
    let mut stats = InlineResourcePayloadStats::default();

    for action in actions {
        match action {
            Action::Draw { shape, .. } => {
                add_shape_payload_stats(&mut stats, shape);
            }
            Action::Update {
                old_shape,
                new_shape,
                ..
            } => {
                add_shape_payload_stats(&mut stats, old_shape);
                add_shape_payload_stats(&mut stats, new_shape);
            }
            Action::BatchUpdate { updates } => {
                for update in updates {
                    add_shape_payload_stats(&mut stats, &update.old_shape);
                    add_shape_payload_stats(&mut stats, &update.new_shape);
                }
            }
            _ => {}
        }
    }

    stats
}

#[cfg(test)]
pub fn collect_resource_inventory<'a, I>(shapes: I) -> ResourceInventoryStats
where
    I: IntoIterator<Item = &'a ShapeData>,
{
    let mut collector = ResourceInventoryCollector::default();
    for shape in shapes {
        collector.add_shape(shape);
    }
    collector.into_stats()
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use whiteboard_shared::{Action, ShapeData};

    use super::{
        collect_action_inline_resource_payload_stats, collect_action_resource_catalog,
        collect_resource_inventory, estimate_data_url_payload_bytes,
    };

    #[test]
    fn estimates_base64_payload_bytes() {
        assert_eq!(
            estimate_data_url_payload_bytes("data:image/png;base64,QUJD"),
            3
        );
        assert_eq!(
            estimate_data_url_payload_bytes("data:image/png;base64,QUI="),
            2
        );
        assert_eq!(
            estimate_data_url_payload_bytes("data:image/png;base64,QQ=="),
            1
        );
    }

    #[test]
    fn collects_total_and_unique_resource_stats() {
        let duplicate = "data:image/png;base64,QUJD".to_string();
        let other = "data:image/png;base64,QUI=".to_string();
        let shapes = vec![
            ShapeData::Image {
                x: 0.0,
                y: 0.0,
                width: 10.0,
                height: 10.0,
                src: duplicate.clone(),
                src_resource_id: None,
                rotation: None,
                scale_x: None,
                scale_y: None,
            },
            ShapeData::Markdown {
                x: 0.0,
                y: 0.0,
                width: 20.0,
                height: 20.0,
                content: "x".to_string(),
                rendered_image: duplicate,
                rendered_image_resource_id: None,
                rotation: None,
                scale_x: None,
                scale_y: None,
            },
            ShapeData::Markdown {
                x: 0.0,
                y: 0.0,
                width: 20.0,
                height: 20.0,
                content: "y".to_string(),
                rendered_image: other,
                rendered_image_resource_id: None,
                rotation: None,
                scale_x: None,
                scale_y: None,
            },
        ];

        let stats = collect_resource_inventory(shapes.iter());
        assert_eq!(stats.total_resources, 3);
        assert_eq!(stats.unique_resources, 2);
        assert_eq!(stats.total_resource_bytes, 8);
        assert_eq!(stats.unique_resource_bytes, 5);
    }

    #[test]
    fn collects_deduplicated_resource_catalog() {
        let duplicate = "data:image/png;base64,QUJD".to_string();
        let shapes = vec![
            ShapeData::Image {
                x: 0.0,
                y: 0.0,
                width: 10.0,
                height: 10.0,
                src: duplicate.clone(),
                src_resource_id: None,
                rotation: None,
                scale_x: None,
                scale_y: None,
            },
            ShapeData::Image {
                x: 1.0,
                y: 1.0,
                width: 10.0,
                height: 10.0,
                src: duplicate.clone(),
                src_resource_id: None,
                rotation: None,
                scale_x: None,
                scale_y: None,
            },
        ];

        let catalog = super::collect_resource_catalog(shapes.iter());
        assert_eq!(catalog.len(), 1);
        let entry = catalog.values().next().expect("resource entry");
        assert_eq!(entry.byte_length, 3);
        assert_eq!(entry.mime_type.as_deref(), Some("image/png"));
    }

    #[test]
    fn collects_resources_from_persisted_action_history() {
        let image_a = ShapeData::Image {
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            src: "data:image/png;base64,QUJD".to_string(),
            src_resource_id: None,
            rotation: None,
            scale_x: None,
            scale_y: None,
        };
        let image_b = ShapeData::Image {
            x: 20.0,
            y: 20.0,
            width: 10.0,
            height: 10.0,
            src: "data:image/png;base64,REVG".to_string(),
            src_resource_id: None,
            rotation: None,
            scale_x: None,
            scale_y: None,
        };
        let actions = vec![Action::Update {
            id: Uuid::new_v4(),
            old_shape: image_a,
            new_shape: image_b,
        }];

        let catalog = collect_action_resource_catalog(actions.iter());
        assert_eq!(catalog.len(), 2);
    }

    #[test]
    fn collects_inline_payload_stats_from_action_history() {
        let actions = vec![Action::BatchUpdate {
            updates: vec![whiteboard_shared::UpdateItem {
                id: Uuid::new_v4(),
                old_shape: ShapeData::Image {
                    x: 0.0,
                    y: 0.0,
                    width: 10.0,
                    height: 10.0,
                    src: "data:image/png;base64,QUJD".to_string(),
                    src_resource_id: None,
                    rotation: None,
                    scale_x: None,
                    scale_y: None,
                },
                new_shape: ShapeData::Markdown {
                    x: 0.0,
                    y: 0.0,
                    width: 10.0,
                    height: 10.0,
                    content: "x".to_string(),
                    rendered_image: "data:image/png;base64,QUI=".to_string(),
                    rendered_image_resource_id: None,
                    rotation: None,
                    scale_x: None,
                    scale_y: None,
                },
            }],
        }];

        let stats = collect_action_inline_resource_payload_stats(actions.iter());
        assert_eq!(stats.total_payloads, 2);
        assert_eq!(stats.total_payload_bytes, 5);
    }
}
