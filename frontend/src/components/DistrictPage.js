import React, { useState, useEffect } from "react";
import axios from "axios";
import "./DistrictPage.css";

const DistrictPage = () => {
  const [districts] = useState(["Thiruvallur", "Chennai"]); // Static dropdown for districts
  const [batches] = useState(["10:00:00", "10:30:00", "11:00:00"]); // Static dropdown for batches
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [tableData, setTableData] = useState([]);

  // Function to handle notifications for a specific District
  const handleDistrictMessage = async (districtId) => {
    try {
      const response = await axios.post(`http://localhost:5000/api/notify-district/${districtId}`);
      if (response.status === 200) {
        console.log('Notifications sent successfully for the District');
      }
    } catch (error) {
      console.log('Error in notifying District:', error);
    }
  };

  // Function to handle call initiation for a specific District
  const handleDistrictCall = async (districtId) => {
    try {
      const response = await axios.post(`http://localhost:5000/api/call-district/${districtId}`);
      if (response.status === 200) {
        console.log('Call initiated successfully for the District');
      }
    } catch (error) {
      console.error('Error in calling District:', error);
    }
  };

  // Fetch data based on district and batch
  const fetchTableData = async () => {
    if (!selectedDistrict || !selectedBatch) return; // Ensure both are selected
    try {
      const response = await axios.get(
        `http://localhost:5000/api/district-data`,
        {
          params: {
            district: selectedDistrict,
            batch: selectedBatch,
          },
        }
      );
      setTableData(response.data);
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  // Trigger fetch when district or batch changes
  useEffect(() => {
    fetchTableData();
  }, [selectedDistrict, selectedBatch]);

  // Handle Notify All functionality
  const handleNotifyAll = async () => {
    try {
      const response = await axios.post(`http://localhost:5000/api/notify-all`, {
        district: selectedDistrict,
        batch: selectedBatch,
      });
      if (response.status === 200) {
        console.log('Notifications sent to all shops successfully');
      }
    } catch (error) {
      console.log('Error in notifying all shops:', error);
    }
  };

  // Handle Call All functionality
  const handleCallAll = async () => {
    try {
      const response = await axios.post(`http://localhost:5000/api/call-all`, {
        district: selectedDistrict,
        batch: selectedBatch,
      });
      if (response.status === 200) {
        console.log('Calls initiated to all shops successfully');
      }
    } catch (error) {
      console.error('Error in calling all shops:', error);
    }
  };

  return (
    <div className="district-page">
      <h2 className="d">District Page</h2>

      {/* Dropdown for District */}
      <div className="dropdown-container">
        <label htmlFor="district-select">Select District:</label>
        <select
          id="district-select"
          value={selectedDistrict}
          onChange={(e) => {
            setSelectedDistrict(e.target.value);
            setSelectedBatch(""); // Reset batch when district changes
          }}
        >
          <option value="">-- Select District --</option>
          {districts.map((district, index) => (
            <option key={index} value={district}>
              {district}
            </option>
          ))}
        </select>
      </div>

      {/* Dropdown for Batch */}
      {selectedDistrict && (
        <div className="dropdown-container">
          <label htmlFor="batch-select">Select Batch:</label>
          <select
            id="batch-select"
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            <option value="">-- Select Batch --</option>
            {batches.map((batch, index) => (
              <option key={index} value={batch}>
                {batch}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* "Notify All" and "Call All" Buttons */}
      {selectedBatch && (
        <div className="button-container">
          <button className="notify-all-button" onClick={handleNotifyAll}>
            Notify All
          </button>
          <button className="call-all-button" onClick={handleCallAll}>
            Call All
          </button>
        </div>
      )}

      {/* Table Display */}
      {selectedBatch && tableData.length > 0 && (
        <div className="table-container">
          <table className="district-table">
            <thead>
              <tr>
                <th>Shop Code</th>
                <th>Shop Name</th>
                <th>Incharge</th>
                <th>Email</th>
                <th>Opening Time</th>
                <th>Taluk</th>
                <th>District</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Batch</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((shop, index) => (
                <tr key={index}>
                  <td>{shop.shop_code}</td>
                  <td>{shop.shop_name}</td>
                  <td>{shop.shop_incharge}</td>
                  <td>{shop.email}</td>
                  <td>{shop.opening_time}</td>
                  <td>{shop.taluk}</td>
                  <td>{shop.district}</td>
                  <td>{shop.status}</td>
                  <td>{shop.remarks}</td>
                  <td>{shop.upload_batch}</td>
                  <td>
                    {shop.status === "Closed" &&
                    (shop.remarks === "NIL" || shop.remarks === "-") ? (
                      <>
                        <button
                          className="message-button"
                          onClick={() => handleDistrictMessage(shop.shop_code)}
                        >
                          Send Message
                        </button>
                        <button
                          className="call-button"
                          onClick={() => handleDistrictCall(shop.shop_code)}
                        >
                          Call Incharge
                        </button>
                      </>
                    ) : shop.status === "Open" ? (
                      <span>Opened</span>
                    ) : (
                      <span>{shop.remarks}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No data message */}
      {selectedBatch && tableData.length === 0 && (
        <p>No data available for the selected district and batch.</p>
      )}
    </div>
  );
};

export default DistrictPage;
