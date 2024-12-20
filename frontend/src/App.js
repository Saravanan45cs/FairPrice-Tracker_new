import React, { useState } from 'react';
import './App.css';
import axios from 'axios';
import UploadExcel from './components/UploadExcel';
import StatePage from './components/StatePage';
import DistrictPage from './components/DistrictPage';

const App = () => {
  const [role, setRole] = useState('');
  const [excelData, setExcelData] = useState([]);

  const handleLogin = async (username, password, role) => {
    try {
      const response = await axios.post('http://localhost:5000/api/login', { username, password, role });
      setRole(response.data.role);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  // Render page based on user role
  const renderPageByRole = () => {
    if (role === 'state') return <StatePage />;
    if (role === 'district') return <DistrictPage />;
    if (role === 'taluk') {
      // Pass setExcelData and excelData as props to UploadExcel
      return <UploadExcel setExcelData={setExcelData} excelData={excelData} />;
    }
    return <p>Please log in to access your page.</p>;
  };

  return (
    <div className="App">
      <h1>Fair Price Tracker</h1>
      {!role ? (
        <LoginForm onLogin={handleLogin} />
      ) : (
        renderPageByRole()
      )}
    </div>
  );
};

// Login Form Component
const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!role) {
      alert("Please select a role.");
      return;
    }
    onLogin(username, password, role);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <select onChange={(e) => setRole(e.target.value)} value={role}>
        <option value="">Select Role</option>
        <option value="state">State</option>
        <option value="district">District</option>
        <option value="taluk">Taluk</option>
      </select>
      <button type="submit">Login</button>
    </form>
  );
};

export default App;
