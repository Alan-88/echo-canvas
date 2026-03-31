use indexmap::IndexMap;

use crate::resource_inventory::{ResourceCatalogEntry, ResourceKind};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSnapshot {
    pub id: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    pub byte_length: usize,
    pub data_url: String,
}

fn resource_kind_label(kind: ResourceKind) -> String {
    match kind {
        ResourceKind::ImageSrc => "imageSrc".to_string(),
        ResourceKind::MarkdownRenderedImage => "markdownRenderedImage".to_string(),
    }
}

pub fn to_resource_snapshot(entry: ResourceCatalogEntry) -> ResourceSnapshot {
    ResourceSnapshot {
        id: entry.id,
        kind: resource_kind_label(entry.kind),
        mime_type: entry.mime_type,
        byte_length: entry.byte_length,
        data_url: entry.data_url,
    }
}

pub fn merge_resource_catalog(
    target: &mut IndexMap<String, ResourceSnapshot>,
    source: IndexMap<String, ResourceCatalogEntry>,
) {
    for (resource_id, entry) in source {
        target
            .entry(resource_id)
            .or_insert_with(|| to_resource_snapshot(entry));
    }
}
