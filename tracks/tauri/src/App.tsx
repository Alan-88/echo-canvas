import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Lobby } from './pages/Lobby';
import { RemoteLobbyPage } from './pages/RemoteLobbyPage';
import { RoomPage } from './pages/RoomPage';
import './App.css';

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/remote-lobby" element={<RemoteLobbyPage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  );
}

export default App;
