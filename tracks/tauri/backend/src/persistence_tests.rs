use indexmap::IndexMap;
use uuid::Uuid;

use crate::persistence::{CanvasSnapshot, LayerSnapshot, RoomSnapshot, SaveMetadata};
use crate::resource_snapshot::ResourceSnapshot;
use crate::snapshot_codec::{serialize_snapshot, SnapshotFormat};
use crate::state::RoomState;
use whiteboard_shared::{Action, ShapeData};

fn first_canvas_and_layer_ids(room: &RoomState) -> (Uuid, Uuid) {
    let (canvas_id, canvas_arc) = room.canvases.first().expect("default canvas");
    let canvas = canvas_arc.read().unwrap();
    let (layer_id, _) = canvas.layers.first().expect("default layer");
    (*canvas_id, *layer_id)
}

#[test]
fn snapshot_resources_cover_persisted_history_refs() {
    let room = RoomState::new("room-1".to_string());
    let (canvas_id, layer_id) = first_canvas_and_layer_ids(&room);
    let canvas = room.canvases.get(&canvas_id).expect("canvas");
    let canvas = canvas.read().unwrap();
    let layer = canvas.layers.get(&layer_id).expect("layer");
    let mut layer = layer.write().unwrap();
    let shape_id = Uuid::new_v4();
    let old_shape = ShapeData::Image {
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
    let new_shape = ShapeData::Image {
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

    layer.actions = vec![
        Action::Draw {
            id: shape_id,
            shape: old_shape.clone(),
        },
        Action::Update {
            id: shape_id,
            old_shape,
            new_shape: new_shape.clone(),
        },
    ];
    layer.pointer = layer.actions.len();
    drop(layer);
    drop(canvas);

    let snapshot = RoomSnapshot::from_room_state_no_token(&room);
    assert_eq!(snapshot.resources.len(), 2);
    assert_eq!(snapshot.metadata.snapshot_inline_payloads_stripped, 3);
    assert_eq!(snapshot.metadata.snapshot_inline_bytes_stripped, 9);

    let layer_snapshot = snapshot
        .canvases
        .get(&canvas_id)
        .and_then(|canvas| canvas.layers.get(&layer_id))
        .expect("layer snapshot");

    let Action::Draw { shape, .. } = &layer_snapshot.actions[0] else {
        panic!("expected draw action");
    };
    let ShapeData::Image {
        src,
        src_resource_id: draw_resource_id,
        ..
    } = shape
    else {
        panic!("expected image shape");
    };
    assert!(src.is_empty());
    assert!(draw_resource_id.is_some());

    let Action::Update {
        old_shape,
        new_shape,
        ..
    } = &layer_snapshot.actions[1]
    else {
        panic!("expected update action");
    };
    let ShapeData::Image {
        src: old_src,
        src_resource_id: old_resource_id,
        ..
    } = old_shape
    else {
        panic!("expected old image shape");
    };
    let ShapeData::Image {
        src: new_src,
        src_resource_id: new_resource_id,
        ..
    } = new_shape
    else {
        panic!("expected new image shape");
    };
    assert!(old_src.is_empty());
    assert!(new_src.is_empty());
    assert!(old_resource_id.is_some());
    assert!(new_resource_id.is_some());
}

#[test]
fn restores_inline_resources_from_snapshot_resource_table() {
    let canvas_id = Uuid::new_v4();
    let layer_id = Uuid::new_v4();
    let image_resource_id = "image-src-1".to_string();
    let markdown_resource_id = "markdown-rendered-image-1".to_string();

    let mut layer_snapshots = IndexMap::new();
    layer_snapshots.insert(
        layer_id,
        LayerSnapshot {
            id: layer_id,
            name: "Layer 1".to_string(),
            actions: vec![
                Action::Draw {
                    id: Uuid::new_v4(),
                    shape: ShapeData::Image {
                        x: 0.0,
                        y: 0.0,
                        width: 20.0,
                        height: 20.0,
                        src: String::new(),
                        src_resource_id: Some(image_resource_id.clone()),
                        rotation: None,
                        scale_x: None,
                        scale_y: None,
                    },
                },
                Action::Draw {
                    id: Uuid::new_v4(),
                    shape: ShapeData::Markdown {
                        x: 10.0,
                        y: 10.0,
                        width: 100.0,
                        height: 40.0,
                        content: "$f(x)$".to_string(),
                        rendered_image: String::new(),
                        rendered_image_resource_id: Some(markdown_resource_id.clone()),
                        rotation: None,
                        scale_x: None,
                        scale_y: None,
                    },
                },
            ],
            pointer: 2,
        },
    );

    let mut canvases = IndexMap::new();
    canvases.insert(
        canvas_id,
        CanvasSnapshot {
            id: canvas_id,
            name: "Canvas 1".to_string(),
            layers: layer_snapshots,
        },
    );

    let mut resources = IndexMap::new();
    resources.insert(
        image_resource_id.clone(),
        ResourceSnapshot {
            id: image_resource_id,
            kind: "imageSrc".to_string(),
            mime_type: Some("image/png".to_string()),
            byte_length: 3,
            data_url: "data:image/png;base64,QUJD".to_string(),
        },
    );
    resources.insert(
        markdown_resource_id.clone(),
        ResourceSnapshot {
            id: markdown_resource_id,
            kind: "markdownRenderedImage".to_string(),
            mime_type: Some("image/png".to_string()),
            byte_length: 3,
            data_url: "data:image/png;base64,REVG".to_string(),
        },
    );

    let snapshot = RoomSnapshot {
        restore_token: None,
        original_room_id: "room-1".to_string(),
        saved_at: "2026-03-18T00:00:00Z".to_string(),
        canvases,
        resources,
        metadata: SaveMetadata {
            canvas_count: 1,
            total_shapes: 2,
            total_resources: 2,
            unique_resources: 2,
            total_resource_bytes: 6,
            unique_resource_bytes: 6,
            snapshot_inline_payloads_stripped: 0,
            snapshot_inline_bytes_stripped: 0,
            save_count: 1,
        },
    };

    let room = snapshot.to_room_state("room-2".to_string(), "token-1".to_string());
    let canvas = room.canvases.get(&canvas_id).expect("restored canvas");
    let canvas = canvas.read().unwrap();
    let layer = canvas.layers.get(&layer_id).expect("restored layer");
    let layer = layer.read().unwrap();

    let Action::Draw { shape, .. } = &layer.actions[0] else {
        panic!("expected image draw");
    };
    let ShapeData::Image { src, .. } = shape else {
        panic!("expected restored image");
    };
    assert_eq!(src, "data:image/png;base64,QUJD");

    let Action::Draw { shape, .. } = &layer.actions[1] else {
        panic!("expected markdown draw");
    };
    let ShapeData::Markdown { rendered_image, .. } = shape else {
        panic!("expected restored markdown");
    };
    assert_eq!(rendered_image, "data:image/png;base64,REVG");
}

#[test]
fn stripped_snapshot_serializes_smaller_than_inline_equivalent() {
    let room = RoomState::new("room-1".to_string());
    let (canvas_id, layer_id) = first_canvas_and_layer_ids(&room);
    let canvas = room.canvases.get(&canvas_id).expect("canvas");
    let canvas = canvas.read().unwrap();
    let layer = canvas.layers.get(&layer_id).expect("layer");
    let mut layer = layer.write().unwrap();
    let shape_id = Uuid::new_v4();
    let base64_payload = "data:image/png;base64,".to_string() + &"QUJD".repeat(256);

    layer.actions = vec![Action::Draw {
        id: shape_id,
        shape: ShapeData::Image {
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            src: base64_payload.clone(),
            src_resource_id: None,
            rotation: None,
            scale_x: None,
            scale_y: None,
        },
    }];
    layer.pointer = 1;
    drop(layer);
    drop(canvas);

    let stripped_snapshot = RoomSnapshot::from_room_state_no_token(&room);

    let mut inline_snapshot = RoomSnapshot::from_room_state_no_token(&room);
    let layer_snapshot = inline_snapshot
        .canvases
        .get_mut(&canvas_id)
        .and_then(|canvas| canvas.layers.get_mut(&layer_id))
        .expect("layer snapshot");
    let Action::Draw { shape, .. } = &mut layer_snapshot.actions[0] else {
        panic!("expected draw action");
    };
    let ShapeData::Image {
        src,
        src_resource_id,
        ..
    } = shape
    else {
        panic!("expected image shape");
    };
    *src = base64_payload;
    *src_resource_id = None;

    let stripped_json =
        serialize_snapshot(&stripped_snapshot, SnapshotFormat::Json).expect("strip json");
    let inline_json =
        serialize_snapshot(&inline_snapshot, SnapshotFormat::Json).expect("inline json");
    assert!(stripped_json.len() < inline_json.len());
    assert_eq!(
        stripped_snapshot.metadata.snapshot_inline_payloads_stripped,
        1
    );
    assert!(stripped_snapshot.metadata.snapshot_inline_bytes_stripped > 0);
}
