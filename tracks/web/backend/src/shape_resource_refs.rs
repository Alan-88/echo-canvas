use std::collections::HashMap;

use indexmap::IndexMap;
use uuid::Uuid;
use whiteboard_shared::{Action, ShapeData, UpdateItem};

use crate::resource_inventory::{build_resource_id, ResourceKind};
use crate::resource_snapshot::ResourceSnapshot;

pub fn attach_shape_resource_refs(shape: &ShapeData) -> ShapeData {
    match shape {
        ShapeData::Image {
            x,
            y,
            width,
            height,
            src,
            src_resource_id,
            rotation,
            scale_x,
            scale_y,
        } => ShapeData::Image {
            x: *x,
            y: *y,
            width: *width,
            height: *height,
            src: src.clone(),
            src_resource_id: src_resource_id.clone().or_else(|| {
                (!src.is_empty()).then(|| build_resource_id(ResourceKind::ImageSrc, src))
            }),
            rotation: *rotation,
            scale_x: *scale_x,
            scale_y: *scale_y,
        },
        ShapeData::Markdown {
            x,
            y,
            width,
            height,
            content,
            rendered_image,
            rendered_image_resource_id,
            rotation,
            scale_x,
            scale_y,
        } => ShapeData::Markdown {
            x: *x,
            y: *y,
            width: *width,
            height: *height,
            content: content.clone(),
            rendered_image: rendered_image.clone(),
            rendered_image_resource_id: rendered_image_resource_id.clone().or_else(|| {
                (!rendered_image.is_empty())
                    .then(|| build_resource_id(ResourceKind::MarkdownRenderedImage, rendered_image))
            }),
            rotation: *rotation,
            scale_x: *scale_x,
            scale_y: *scale_y,
        },
        _ => shape.clone(),
    }
}

pub fn attach_action_resource_refs(action: &Action) -> Action {
    match action {
        Action::Draw { id, shape } => Action::Draw {
            id: *id,
            shape: attach_shape_resource_refs(shape),
        },
        Action::Update {
            id,
            old_shape,
            new_shape,
        } => Action::Update {
            id: *id,
            old_shape: attach_shape_resource_refs(old_shape),
            new_shape: attach_shape_resource_refs(new_shape),
        },
        Action::BatchUpdate { updates } => Action::BatchUpdate {
            updates: updates
                .iter()
                .map(|update| UpdateItem {
                    id: update.id,
                    old_shape: attach_shape_resource_refs(&update.old_shape),
                    new_shape: attach_shape_resource_refs(&update.new_shape),
                })
                .collect(),
        },
        _ => action.clone(),
    }
}

pub fn strip_shape_inline_resources_for_snapshot(shape: &ShapeData) -> ShapeData {
    match shape {
        ShapeData::Image {
            x,
            y,
            width,
            height,
            src_resource_id,
            rotation,
            scale_x,
            scale_y,
            ..
        } if src_resource_id.is_some() => ShapeData::Image {
            x: *x,
            y: *y,
            width: *width,
            height: *height,
            src: String::new(),
            src_resource_id: src_resource_id.clone(),
            rotation: *rotation,
            scale_x: *scale_x,
            scale_y: *scale_y,
        },
        ShapeData::Markdown {
            x,
            y,
            width,
            height,
            content,
            rendered_image_resource_id,
            rotation,
            scale_x,
            scale_y,
            ..
        } if rendered_image_resource_id.is_some() => ShapeData::Markdown {
            x: *x,
            y: *y,
            width: *width,
            height: *height,
            content: content.clone(),
            rendered_image: String::new(),
            rendered_image_resource_id: rendered_image_resource_id.clone(),
            rotation: *rotation,
            scale_x: *scale_x,
            scale_y: *scale_y,
        },
        _ => shape.clone(),
    }
}

pub fn strip_action_inline_resources_for_snapshot(action: &Action) -> Action {
    match action {
        Action::Draw { id, shape } => Action::Draw {
            id: *id,
            shape: strip_shape_inline_resources_for_snapshot(shape),
        },
        Action::Update {
            id,
            old_shape,
            new_shape,
        } => Action::Update {
            id: *id,
            old_shape: strip_shape_inline_resources_for_snapshot(old_shape),
            new_shape: strip_shape_inline_resources_for_snapshot(new_shape),
        },
        Action::BatchUpdate { updates } => Action::BatchUpdate {
            updates: updates
                .iter()
                .map(|update| UpdateItem {
                    id: update.id,
                    old_shape: strip_shape_inline_resources_for_snapshot(&update.old_shape),
                    new_shape: strip_shape_inline_resources_for_snapshot(&update.new_shape),
                })
                .collect(),
        },
        _ => action.clone(),
    }
}

pub fn hydrate_shape_from_resources(
    shape: &ShapeData,
    resources: &IndexMap<String, ResourceSnapshot>,
) -> ShapeData {
    match shape {
        ShapeData::Image {
            x,
            y,
            width,
            height,
            src,
            src_resource_id,
            rotation,
            scale_x,
            scale_y,
        } => ShapeData::Image {
            x: *x,
            y: *y,
            width: *width,
            height: *height,
            src: if src.is_empty() {
                src_resource_id
                    .as_ref()
                    .and_then(|resource_id| resources.get(resource_id))
                    .map(|resource| resource.data_url.clone())
                    .unwrap_or_default()
            } else {
                src.clone()
            },
            src_resource_id: src_resource_id.clone(),
            rotation: *rotation,
            scale_x: *scale_x,
            scale_y: *scale_y,
        },
        ShapeData::Markdown {
            x,
            y,
            width,
            height,
            content,
            rendered_image,
            rendered_image_resource_id,
            rotation,
            scale_x,
            scale_y,
        } => ShapeData::Markdown {
            x: *x,
            y: *y,
            width: *width,
            height: *height,
            content: content.clone(),
            rendered_image: if rendered_image.is_empty() {
                rendered_image_resource_id
                    .as_ref()
                    .and_then(|resource_id| resources.get(resource_id))
                    .map(|resource| resource.data_url.clone())
                    .unwrap_or_default()
            } else {
                rendered_image.clone()
            },
            rendered_image_resource_id: rendered_image_resource_id.clone(),
            rotation: *rotation,
            scale_x: *scale_x,
            scale_y: *scale_y,
        },
        _ => shape.clone(),
    }
}

pub fn hydrate_action_from_resources(
    action: &Action,
    resources: &IndexMap<String, ResourceSnapshot>,
) -> Action {
    match action {
        Action::Draw { id, shape } => Action::Draw {
            id: *id,
            shape: hydrate_shape_from_resources(shape, resources),
        },
        Action::Update {
            id,
            old_shape,
            new_shape,
        } => Action::Update {
            id: *id,
            old_shape: hydrate_shape_from_resources(old_shape, resources),
            new_shape: hydrate_shape_from_resources(new_shape, resources),
        },
        Action::BatchUpdate { updates } => Action::BatchUpdate {
            updates: updates
                .iter()
                .map(|update| UpdateItem {
                    id: update.id,
                    old_shape: hydrate_shape_from_resources(&update.old_shape, resources),
                    new_shape: hydrate_shape_from_resources(&update.new_shape, resources),
                })
                .collect(),
        },
        _ => action.clone(),
    }
}

pub fn fill_shape_resources_if_missing(
    id: &Uuid,
    new_shape: &ShapeData,
    visible_shapes: &HashMap<Uuid, ShapeData>,
) -> ShapeData {
    match new_shape {
        ShapeData::Image {
            src,
            src_resource_id,
            x,
            y,
            width,
            height,
            rotation,
            scale_x,
            scale_y,
        } => {
            if src.is_empty() || src_resource_id.is_none() {
                if let Some(ShapeData::Image {
                    src: existing_src,
                    src_resource_id: existing_src_resource_id,
                    ..
                }) = visible_shapes.get(id)
                {
                    return ShapeData::Image {
                        x: *x,
                        y: *y,
                        width: *width,
                        height: *height,
                        src: if src.is_empty() {
                            existing_src.clone()
                        } else {
                            src.clone()
                        },
                        src_resource_id: src_resource_id
                            .clone()
                            .or_else(|| existing_src_resource_id.clone()),
                        rotation: *rotation,
                        scale_x: *scale_x,
                        scale_y: *scale_y,
                    };
                }
            }
            new_shape.clone()
        }
        ShapeData::Markdown {
            content,
            rendered_image,
            rendered_image_resource_id,
            x,
            y,
            width,
            height,
            rotation,
            scale_x,
            scale_y,
        } => {
            if rendered_image.is_empty() || rendered_image_resource_id.is_none() {
                if let Some(ShapeData::Markdown {
                    rendered_image: existing_rendered_image,
                    rendered_image_resource_id: existing_rendered_image_resource_id,
                    ..
                }) = visible_shapes.get(id)
                {
                    return ShapeData::Markdown {
                        x: *x,
                        y: *y,
                        width: *width,
                        height: *height,
                        content: content.clone(),
                        rendered_image: if rendered_image.is_empty() {
                            existing_rendered_image.clone()
                        } else {
                            rendered_image.clone()
                        },
                        rendered_image_resource_id: rendered_image_resource_id
                            .clone()
                            .or_else(|| existing_rendered_image_resource_id.clone()),
                        rotation: *rotation,
                        scale_x: *scale_x,
                        scale_y: *scale_y,
                    };
                }
            }
            new_shape.clone()
        }
        _ => new_shape.clone(),
    }
}

#[cfg(test)]
mod tests {
    use indexmap::IndexMap;

    use crate::resource_snapshot::ResourceSnapshot;

    use super::{
        attach_shape_resource_refs, hydrate_shape_from_resources,
        strip_shape_inline_resources_for_snapshot,
    };
    use whiteboard_shared::ShapeData;

    #[test]
    fn attaches_markdown_resource_id_when_inline_image_exists() {
        let shape = ShapeData::Markdown {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
            content: "x".to_string(),
            rendered_image: "data:image/png;base64,QUJD".to_string(),
            rendered_image_resource_id: None,
            rotation: None,
            scale_x: None,
            scale_y: None,
        };

        let attached = attach_shape_resource_refs(&shape);
        let ShapeData::Markdown {
            rendered_image_resource_id,
            ..
        } = attached
        else {
            panic!("expected markdown");
        };
        assert!(rendered_image_resource_id.is_some());
    }

    #[test]
    fn hydrates_image_from_resource_table_when_inline_src_missing() {
        let resource_id = "image-src-123".to_string();
        let shape = ShapeData::Image {
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            src: "".to_string(),
            src_resource_id: Some(resource_id.clone()),
            rotation: None,
            scale_x: None,
            scale_y: None,
        };
        let mut resources = IndexMap::new();
        resources.insert(
            resource_id.clone(),
            ResourceSnapshot {
                id: resource_id,
                kind: "imageSrc".to_string(),
                mime_type: Some("image/png".to_string()),
                byte_length: 3,
                data_url: "data:image/png;base64,QUJD".to_string(),
            },
        );

        let hydrated = hydrate_shape_from_resources(&shape, &resources);
        let ShapeData::Image { src, .. } = hydrated else {
            panic!("expected image");
        };
        assert_eq!(src, "data:image/png;base64,QUJD");
    }

    #[test]
    fn strips_markdown_inline_rendered_image_when_resource_id_exists() {
        let shape = ShapeData::Markdown {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
            content: "x".to_string(),
            rendered_image: "data:image/png;base64,QUJD".to_string(),
            rendered_image_resource_id: Some("markdown-rendered-image-1".to_string()),
            rotation: None,
            scale_x: None,
            scale_y: None,
        };

        let stripped = strip_shape_inline_resources_for_snapshot(&shape);
        let ShapeData::Markdown {
            rendered_image,
            rendered_image_resource_id,
            ..
        } = stripped
        else {
            panic!("expected markdown");
        };
        assert!(rendered_image.is_empty());
        assert_eq!(
            rendered_image_resource_id.as_deref(),
            Some("markdown-rendered-image-1")
        );
    }
}
