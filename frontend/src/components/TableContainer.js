import React from 'react';

const TableContainer = ({ excelData, renderActionColumn }) => {
  if (excelData.length === 0) return null;

  return (
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
          {excelData.map((row, index) => (
            <tr key={index}>
              {Object.values(row).map((value, i) => (
                <td key={i}>{value}</td>
              ))}
              <td>{renderActionColumn(row.status, row.remarks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableContainer;
