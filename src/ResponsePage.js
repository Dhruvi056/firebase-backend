import React from 'react';

const ResponsePage = ({ data, onBack }) => {
    const submittedData = data || JSON.parse(localStorage.getItem('formSubmissionData'));

    if (!submittedData) {
        return (
            <div style={{ padding: 40, textAlign: "center" }}>
                <h2>No submission data found</h2>
                <p>Please submit the form first.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: 40, maxWidth: 600, margin: "0 auto", fontFamily: "Arial" }}>

            <div style={{ textAlign: "center", marginBottom: 30 }}>
                <h1 style={{ color: "green" }}>Form Submitted Successfully!</h1>
                <p style={{ color: "#666" }}>Thank you for your submission</p>
            </div>

            <div style={{ background: "#f5f5f5", padding: 25, borderRadius: 8 }}>
                <h2 style={{ marginTop: 0, color: "#333", borderBottom: "2px solid #4CAF50", paddingBottom: 10 }}>
                    Submitted Information
                </h2>

                <div style={{ marginTop: 20 }}>
                    {Object.entries(submittedData).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 15, paddingBottom: 15, borderBottom: "1px solid #ccc" }}>
                            <strong style={{ textTransform: "capitalize" }}>
                                {key}:
                            </strong>
                            <div style={{ marginTop: 5 }}>{value}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 30 }}>
                {onBack && (
                    <button
                        onClick={onBack}
                        style={{
                            padding: "10px 25px",
                            marginRight: 10,
                            background: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: 5,
                            cursor: "pointer",
                        }}
                    >
                        Submit Another Form
                    </button>
                )}

                <button
                    onClick={() => window.close()}
                    style={{
                        padding: "10px 25px",
                        background: "#555",
                        color: "white",
                        border: "none",
                        borderRadius: 5,
                        cursor: "pointer",
                    }}
                >
                    Close Window
                </button>
            </div>
        </div>
    );
};

export default ResponsePage;
