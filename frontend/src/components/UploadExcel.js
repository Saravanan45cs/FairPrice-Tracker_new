import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import './UploadExcel.css';
import Clock from './Clock'; // Import the Clock component

const UploadExcel = ({ setExcelData, excelData }) => {
  const [file, setFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isButtonEnabled, setIsButtonEnabled] = useState(false); // State to manage button enable/disable
  const [reportGenerated, setReportGenerated] = useState(false); // State to manage report status

  // Function to convert Excel time format (decimal) to HH:mm format
  const convertTo24HourFormat = (time) => {
    if (typeof time === 'number') {
      const hours = Math.floor(time * 24); // Get hours
      const minutes = Math.round((time * 24 - hours) * 60); // Get minutes
      return `${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
    }
    return time; // If it's not a number, return it as is
  };

  useEffect(() => {
    // Function to check if it's after 12 PM
    const checkTime = () => {
      const currentTime = new Date();
      const currentHour = currentTime.getHours();

      // Enable the button if it's 12 PM or later
      if (currentHour >= 12) {
        setIsButtonEnabled(true);
      } else {
        setIsButtonEnabled(false);
      }
    };

    // Run the checkTime function initially
    checkTime();

    // Set interval to check every minute to update the button state if needed
    const timer = setInterval(checkTime, 60000);

    // Cleanup the interval on component unmount
    return () => clearInterval(timer);
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('http://localhost:5000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setErrorMessage('');
      parseExcel(file);
    } catch (err) {
      setErrorMessage('Error uploading file: ' + err.message);
    }
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Process only 'opening_time' and 'upload_batch' columns
        const processedData = jsonData.map((shop) => {
          // If 'opening_time' or 'upload_batch' exists, convert them to 24-hour format
          if (shop.opening_time) {
            shop.opening_time = convertTo24HourFormat(shop.opening_time);
          }
          if (shop.upload_batch) {
            shop.upload_batch = convertTo24HourFormat(shop.upload_batch);
          }
          return shop;
        });

        setExcelData(processedData);
      } catch (error) {
        console.error('Error parsing Excel:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMessage = async (shop) => {
    try {
      const response = await axios.post(`http://localhost:5000/api/notify-shop/${shop.shop_id}`);
      console.log(response);
      alert(`Message sent successfully to ${shop.shop_incharge} at ${shop.incharge_number}`);
    } catch (error) {
      alert(`Failed to send message: ${error.message}`);
    }
  };

  const handleCall = async (shop) => {
    try {
      const response = await axios.post(`http://localhost:5000/api/call-shop/${shop.shop_id}`);
      console.log(response);
      alert(`Calling ${shop.shop_incharge} at ${shop.incharge_number} initiated successfully`);
    } catch (error) {
      alert(`Failed to call ${shop.shop_incharge}`);
    }
  };

  // Function to generate the report and send it via email
  const generateReport = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/generate-report');
      if (response.status === 200) {
        setReportGenerated(true);
        alert('Report generated and sent successfully!');
      } else {
        alert('Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report');
    }
  };

  return (
    <div className="upload-container">
      
      {/* <Clock /> Add the Clock component here */}
      <h2>Upload Excel File</h2>
      <br></br>
      <input type="file" onChange={handleFileChange} className="file-input" />
      <button onClick={handleFileUpload} className="upload-button">Upload</button>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {excelData.length > 0 && (
        <div className="table-container">
          <h3>Uploaded Excel Data</h3>
          <table className="excel-table">
            <thead>
              <tr>
                {Object.keys(excelData[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {excelData.map((shop, index) => (
                <tr key={index}>
                  {Object.values(shop).map((value, i) => (
                    <td key={i}>
                      {/* Display values as they are */}
                      {value}
                    </td>
                  ))}
                  <td>
                    {shop.status === 'Closed' && (shop.remarks === 'NIL' || shop.remarks === '-') ? (
                      <>
                        <button
                          className="message-button"
                          onClick={() => handleMessage(shop)}
                        >
                          Send Message
                        </button>
                        <button
                          className="call-button"
                          onClick={() => handleCall(shop)}
                        >
                          Call Incharge
                        </button>
                      </>
                    ) : shop.status === 'Open' ? (
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
      {/* Button for generating report */}
      <button
        onClick={generateReport}
        disabled={!isButtonEnabled || reportGenerated}
        className="generate-report-button"
      >
        {reportGenerated ? 'Report Sent' : 'Generate Report'}
      </button>
    </div>
  );
};

export default UploadExcel;
