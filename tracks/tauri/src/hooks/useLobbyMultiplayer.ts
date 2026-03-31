import { useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  buildRemoteRuntimeConfig,
  setActiveRemoteRuntimeConfig,
  setPreferredRemoteServerAddress,
  getPreferredRemoteServerAddress,
} from '../utils/remoteSessionConfig';
import { probeRemoteServer } from '../utils/remoteServerProbe';

type ProbeState = 'idle' | 'probing' | 'ready' | 'error';

export const useLobbyMultiplayer = (navigate: NavigateFunction) => {
  const [serverAddress, setServerAddress] = useState(getPreferredRemoteServerAddress());
  const [roomId, setRoomId] = useState('');
  const [probeState, setProbeState] = useState<ProbeState>('idle');
  const [probeLatencyMs, setProbeLatencyMs] = useState<number | null>(null);

  const connect = async () => {
    try {
      const config = buildRemoteRuntimeConfig(serverAddress);
      setPreferredRemoteServerAddress(config.serverAddress);
      const targetRoomId = roomId.trim() || '00000000';

      setProbeState('probing');
      const latencyMs = await probeRemoteServer(config.apiBaseUrl, targetRoomId);
      setProbeLatencyMs(latencyMs);
      setProbeState('ready');
      setActiveRemoteRuntimeConfig(config);
      if (!roomId.trim()) {
        navigate('/remote-lobby');
        return;
      }

      navigate(`/room/${roomId.trim()}`);
    } catch (error) {
      console.error('连接远程服务器失败:', error);
      setProbeState('error');
      setProbeLatencyMs(null);
      alert((error as Error).message);
    }
  };

  const statusText =
    probeState === 'probing'
      ? '正在探测服务器连通性...'
      : probeState === 'ready' && probeLatencyMs !== null
        ? `已探测到服务器延迟: ${probeLatencyMs}ms`
        : probeState === 'error'
          ? '服务器不可达，请检查地址、端口或 HTTPS 配置'
          : '可直接输入房间号，或留空进入远端大厅';

  return {
    serverAddress,
    setServerAddress,
    roomId,
    setRoomId,
    connect,
    isConnecting: probeState === 'probing',
    statusText,
  };
};
