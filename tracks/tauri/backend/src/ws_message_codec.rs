use axum::extract::ws::Message;
use whiteboard_shared::{ClientMessage, ServerMessage};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WsMessageCodec {
    Auto,
    Json,
    MessagePack,
}

impl WsMessageCodec {
    pub fn from_env() -> Self {
        match std::env::var("WS_MESSAGE_CODEC")
            .unwrap_or_else(|_| "json".to_string())
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "auto" => WsMessageCodec::Auto,
            "msgpack" | "messagepack" | "mpk" => WsMessageCodec::MessagePack,
            _ => WsMessageCodec::Json,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            WsMessageCodec::Auto => "auto",
            WsMessageCodec::Json => "json",
            WsMessageCodec::MessagePack => "msgpack",
        }
    }
}

fn resolve_server_message_codec(
    message: &ServerMessage,
    codec: WsMessageCodec,
) -> WsMessageCodec {
    match codec {
        WsMessageCodec::Auto => match message {
            ServerMessage::BroadCast { .. } => WsMessageCodec::MessagePack,
            _ => WsMessageCodec::Json,
        },
        _ => codec,
    }
}

pub fn encode_server_message(
    message: &ServerMessage,
    codec: WsMessageCodec,
) -> Result<Message, String> {
    match resolve_server_message_codec(message, codec) {
        WsMessageCodec::Json => serde_json::to_string(message)
            .map(|json| Message::Text(json.into()))
            .map_err(|e| format!("failed to encode server json message: {e}")),
        WsMessageCodec::MessagePack => {
            // Encode through JSON value to normalize map keys as strings.
            // SyncState contains UUID-keyed maps, and raw msgpack map keys can become
            // non-string values that JS decoders reject.
            let normalized = serde_json::to_value(message)
                .map_err(|e| format!("failed to normalize server message for msgpack: {e}"))?;
            rmp_serde::to_vec_named(&normalized)
                .map(|bytes| Message::Binary(bytes.into()))
                .map_err(|e| format!("failed to encode server msgpack message: {e}"))
        }
        WsMessageCodec::Auto => unreachable!("auto codec should resolve before encoding"),
    }
}

pub fn decode_client_message(frame: Message) -> Result<Option<ClientMessage>, String> {
    match frame {
        Message::Text(text) => serde_json::from_str::<ClientMessage>(&text)
            .map(Some)
            .map_err(|e| format!("failed to decode json client message: {e}")),
        Message::Binary(bytes) => {
            let decode_via_json_value = rmp_serde::from_slice::<serde_json::Value>(&bytes)
                .map_err(|e| format!("msgpack->json value decode error: {e}"))
                .and_then(|value| {
                    serde_json::from_value::<ClientMessage>(value)
                        .map(Some)
                        .map_err(|e| format!("json value -> client decode error: {e}"))
                });

            decode_via_json_value
                .or_else(|value_error| {
                    // Fallback for Rust-native msgpack payloads (e.g. UUID as bytes in non-human-readable mode)
                    rmp_serde::from_slice::<ClientMessage>(&bytes)
                        .map(Some)
                        .map_err(|msgpack_error| {
                            format!(
                                "failed to decode binary client message ({value_error}; direct msgpack decode error: {msgpack_error})"
                            )
                        })
                })
                .or_else(|msgpack_error| {
                    serde_json::from_slice::<ClientMessage>(&bytes)
                        .map(Some)
                        .map_err(|json_error| {
                            format!(
                                "failed to decode binary client message ({msgpack_error}; json: {json_error})"
                            )
                        })
                })
        }
        Message::Ping(_) | Message::Pong(_) | Message::Close(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_client_message, encode_server_message, WsMessageCodec};
    use axum::extract::ws::Message;
    use serde_json::json;
    use std::collections::HashMap;
    use uuid::Uuid;
    use whiteboard_shared::{Action, ClientMessage, ServerMessage, ShapeData, UpdateItem};

    fn sample_line(points: usize) -> ShapeData {
        let mut values = Vec::with_capacity(points * 2);
        for index in 0..points {
            values.push(index as f64 * 1.5);
            values.push((index % 17) as f64 * 2.0);
        }
        ShapeData::Line {
            points: values,
            stroke: "#111111".to_string(),
            stroke_width: 4.0,
            x: Some(0.0),
            y: Some(0.0),
            rotation: Some(0.0),
            scale_x: Some(1.0),
            scale_y: Some(1.0),
        }
    }

    fn sample_client_draw_message(points: usize) -> ClientMessage {
        ClientMessage::LayerOp {
            canvas_id: Uuid::nil(),
            layer_id: Uuid::from_u128(1),
            action: Action::Draw {
                id: Uuid::from_u128(2),
                shape: sample_line(points),
            },
        }
    }

    fn sample_client_batch_update_message(items: usize, points: usize) -> ClientMessage {
        ClientMessage::LayerOp {
            canvas_id: Uuid::nil(),
            layer_id: Uuid::from_u128(3),
            action: Action::BatchUpdate {
                updates: (0..items)
                    .map(|index| UpdateItem {
                        id: Uuid::from_u128(100 + index as u128),
                        old_shape: sample_line(points),
                        new_shape: sample_line(points + 4),
                    })
                    .collect(),
            },
        }
    }

    fn sample_server_broadcast_message(points: usize) -> ServerMessage {
        ServerMessage::BroadCast {
            canvas_id: Uuid::nil(),
            layer_id: Uuid::from_u128(1),
            action: Action::Draw {
                id: Uuid::from_u128(2),
                shape: sample_line(points),
            },
        }
    }

    fn encoded_size_pair<T: serde::Serialize>(value: &T) -> (usize, usize) {
        let json_bytes = serde_json::to_vec(value).expect("json encode");
        let msgpack_bytes = rmp_serde::to_vec_named(value).expect("msgpack encode");
        (json_bytes.len(), msgpack_bytes.len())
    }

    fn quantize_points(points: &[f64], scale: f64) -> Vec<i32> {
        points
            .iter()
            .map(|value| (value * scale).round() as i32)
            .collect()
    }

    fn delta_encode(values: &[i32]) -> Vec<i32> {
        let mut previous = 0i32;
        values
            .iter()
            .enumerate()
            .map(|(index, value)| {
                let encoded = if index == 0 { *value } else { *value - previous };
                previous = *value;
                encoded
            })
            .collect()
    }

    fn sample_compact_broadcast_reference(points: usize) -> serde_json::Value {
        let ShapeData::Line {
            points,
            stroke,
            stroke_width,
            ..
        } = sample_line(points)
        else {
            unreachable!("sample line should be line shape");
        };
        let quantized = quantize_points(&points, 10.0);
        let delta_points = delta_encode(&quantized);

        json!({
            "event": "broadCastCompactRef",
            "data": {
                "canvasId": Uuid::nil().to_string(),
                "layerId": Uuid::from_u128(1).to_string(),
                "action": {
                    "type": "drawLineQ",
                    "payload": {
                        "id": Uuid::from_u128(2).to_string(),
                        "shape": {
                            "type": "lineQ",
                            "data": {
                                "deltaPoints": delta_points,
                                "stroke": stroke,
                                "strokeWidthQ": (stroke_width * 10.0).round() as i32,
                                "scaleDivisor": 10
                            }
                        }
                    }
                }
            }
        })
    }

    #[test]
    fn decode_json_client_message() {
        let frame = Message::Text("{\"event\":\"join\"}".to_string().into());
        let decoded = decode_client_message(frame)
            .expect("json decode should succeed")
            .expect("frame should contain message");
        assert!(matches!(decoded, ClientMessage::Join));
    }

    #[test]
    fn decode_msgpack_client_message() {
        let bytes = rmp_serde::to_vec_named(&ClientMessage::Join).expect("encode");
        let frame = Message::Binary(bytes.into());
        let decoded = decode_client_message(frame)
            .expect("msgpack decode should succeed")
            .expect("frame should contain message");
        assert!(matches!(decoded, ClientMessage::Join));
    }

    #[test]
    fn decode_js_style_msgpack_client_message_with_string_uuid() {
        let payload = serde_json::json!({
            "event": "layerOp",
            "data": {
                "canvasId": "00000000-0000-0000-0000-000000000010",
                "layerId": "00000000-0000-0000-0000-000000000001",
                "action": {
                    "type": "draw",
                    "payload": {
                        "id": "11111111-1111-4111-8111-111111111111",
                        "shape": {
                            "type": "line",
                            "data": {
                                "points": [0.0, 0.0, 10.0, 10.0],
                                "stroke": "#111",
                                "stroke_width": 2.0
                            }
                        }
                    }
                }
            }
        });
        let bytes = rmp_serde::to_vec_named(&payload).expect("encode");
        let decoded = decode_client_message(Message::Binary(bytes.into()))
            .expect("decode should succeed")
            .expect("frame should contain message");
        assert!(matches!(decoded, ClientMessage::LayerOp { .. }));
    }

    #[test]
    fn encode_msgpack_server_message() {
        let frame = encode_server_message(
            &ServerMessage::Error {
                message: "oops".to_string(),
            },
            WsMessageCodec::MessagePack,
        )
        .expect("encode");
        assert!(matches!(frame, Message::Binary(_)));
    }

    #[test]
    fn auto_codec_keeps_sync_state_as_json() {
        let frame = encode_server_message(
            &ServerMessage::Error {
                message: "oops".to_string(),
            },
            WsMessageCodec::Auto,
        )
        .expect("encode");
        assert!(matches!(frame, Message::Text(_)));
    }

    #[test]
    fn auto_codec_sends_broadcast_as_binary() {
        let frame =
            encode_server_message(&sample_server_broadcast_message(64), WsMessageCodec::Auto)
                .expect("encode");
        assert!(matches!(frame, Message::Binary(_)));
    }

    #[test]
    fn encode_msgpack_sync_state_normalizes_uuid_map_keys_to_strings() {
        let canvas_id = Uuid::new_v4();
        let layer_id = Uuid::new_v4();
        let mut layers = HashMap::new();
        layers.insert(
            layer_id,
            whiteboard_shared::LayerView {
                id: layer_id,
                name: "Layer 1".to_string(),
                pointer: 0,
                history: Vec::new(),
            },
        );

        let mut canvases = HashMap::new();
        canvases.insert(
            canvas_id,
            whiteboard_shared::CanvasView {
                id: canvas_id,
                name: "Canvas 1".to_string(),
                layers,
                layer_ids: vec![layer_id],
            },
        );

        let frame = encode_server_message(
            &ServerMessage::SyncState {
                room_id: "12345678".to_string(),
                canvases,
                canvas_ids: vec![canvas_id],
                restore_token: None,
            },
            WsMessageCodec::MessagePack,
        )
        .expect("encode");

        let Message::Binary(bytes) = frame else {
            panic!("expected binary frame");
        };
        let value: serde_json::Value = rmp_serde::from_slice(&bytes).expect("decode to json value");
        assert_eq!(
            value.get("event").and_then(|v| v.as_str()),
            Some("syncState")
        );
        assert!(
            value
                .pointer("/data/canvases")
                .and_then(|v| v.as_object())
                .is_some(),
            "canvases should decode as object with string keys"
        );
    }

    #[test]
    fn protocol_baseline_draw_encoders_produce_non_empty_payloads() {
        let payload = sample_client_draw_message(256);
        let (json_bytes, msgpack_bytes) = encoded_size_pair(&payload);
        assert!(json_bytes > 0);
        assert!(msgpack_bytes > 0);
    }

    #[test]
    fn protocol_baseline_batch_update_encoders_produce_non_empty_payloads() {
        let payload = sample_client_batch_update_message(8, 64);
        let (json_bytes, msgpack_bytes) = encoded_size_pair(&payload);
        assert!(json_bytes > 0);
        assert!(msgpack_bytes > 0);
    }

    #[test]
    fn protocol_baseline_server_broadcast_encoders_produce_non_empty_payloads() {
        let payload = sample_server_broadcast_message(256);
        let (json_bytes, msgpack_bytes) = encoded_size_pair(&payload);
        assert!(json_bytes > 0);
        assert!(msgpack_bytes > 0);
    }

    #[test]
    #[ignore = "baseline report only; run with --ignored --nocapture when evaluating codec tradeoffs"]
    fn protocol_baseline_report_current_backend_sizes() {
        let draw = sample_client_draw_message(256);
        let batch = sample_client_batch_update_message(8, 64);
        let server_broadcast = sample_server_broadcast_message(256);
        let compact_broadcast_reference = sample_compact_broadcast_reference(256);
        let (draw_json, draw_msgpack) = encoded_size_pair(&draw);
        let (batch_json, batch_msgpack) = encoded_size_pair(&batch);
        let (broadcast_json, broadcast_msgpack) = encoded_size_pair(&server_broadcast);
        let (compact_ref_json, compact_ref_msgpack) = encoded_size_pair(&compact_broadcast_reference);

        println!(
            "draw bytes => json: {draw_json}, msgpack(named): {draw_msgpack}; batchUpdate bytes => json: {batch_json}, msgpack(named): {batch_msgpack}; server broadcast bytes => json: {broadcast_json}, msgpack(named): {broadcast_msgpack}; compact broadcast ref => json: {compact_ref_json}, msgpack(named): {compact_ref_msgpack}"
        );
    }
}
