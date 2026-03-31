import React from 'react';
import { useParams } from 'react-router-dom';
import { Whiteboard } from '../components/Whiteboard';

export const RoomPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();

  if (!roomId) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontSize: '20px',
        color: '#666'
      }}>
        无效的房间号
      </div>
    );
  }

  return <Whiteboard roomId={roomId} />;
};
