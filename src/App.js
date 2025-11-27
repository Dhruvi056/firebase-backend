import React, { useState } from "react";
import { db } from './firebase';
import { collection, addDoc } from "firebase/firestore";
import ResponsePage from './ResponsePage';

const Registration = () => {
    const [formData, setFormData] = useState({});
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submittedData, setSubmittedData] = useState(null);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!formData.name || !formData.email || !formData.phone || !formData.age || !formData.city || !formData.d) {
            setError("Please fill in all fields");
            setLoading(false);
            return;
        }

        try {

            if (!db) {
                throw new Error("Firebase database not initialized. Please check firebase.js configuration.");
            }

            console.log("Submitting data:", formData);
            console.log("Database instance:", db);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timeout - check Firestore security rules")), 10000)
            );

            const submitPromise = addDoc(collection(db, "formsubmission"), formData);

            const docRef = await Promise.race([submitPromise, timeoutPromise]);

            console.log("Document added successfully with ID:", docRef.id);

            const submittedDate = new Date().toLocaleString();
            const submissionData = {
                ...formData,
                documentId: docRef.id,
                submittedAt: submittedDate
            };

            localStorage.setItem('formSubmissionData', JSON.stringify(submissionData));

            setSubmittedData(submissionData);

            setFormData({});
        } catch (err) {
            console.error("Error adding document: ", err);
            console.error("Error code:", err.code);
            console.error("Error message:", err.message);

            let errorMessage = "Failed to submit. ";
            if (err.code === "permission-denied") {
                errorMessage += "Permission denied. Please check Firestore security rules.";
            } else if (err.message.includes("timeout")) {
                errorMessage += err.message;
            } else {
                errorMessage += err.message || "Please try again.";
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };


    if (submittedData) {
        return <ResponsePage data={submittedData} onBack={() => setSubmittedData(null)} />;
    }

    return (

        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                padding: '40px',
                width: '100%',
                maxWidth: '500px'
            }}>
                <h2 style={{
                    textAlign: 'center',
                    color: '#333',
                    marginBottom: '30px',
                    fontSize: '28px',
                    fontWeight: '600'
                }}>
                    Registration Form
                </h2>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            name="name"
                            placeholder="Name"
                            onChange={handleChange}
                            value={formData.name || ''}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}

                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            name="email"
                            type="email"
                            placeholder="Email"
                            onChange={handleChange}
                            value={formData.email || ''}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            name="phone"
                            placeholder="Phone"
                            onChange={handleChange}
                            value={formData.phone || ''}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}

                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            name="age"
                            type="number"
                            placeholder="Age"
                            onChange={handleChange}
                            value={formData.age || ''}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}

                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <input
                            name="city"
                            placeholder="City"
                            onChange={handleChange}
                            value={formData.city || ''}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}

                        />
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                        <input
                            name="d"
                            placeholder="D"
                            onChange={handleChange}
                            value={formData.d || ''}
                            required
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                boxSizing: 'border-box',
                                outline: 'none',
                                transition: 'border-color 0.3s'
                            }}

                        />
                    </div>

                    {error && (
                        <div style={{
                            color: '#d32f2f',
                            marginBottom: '20px',
                            padding: '10px',
                            backgroundColor: '#ffebee',
                            borderRadius: '5px',
                            fontSize: '14px',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#ffffff',
                            backgroundColor: loading ? '#392e62ff' : '#140353ff',
                            border: 'none',
                            borderRadius: '5px',
                        }}

                    >
                        {loading ? "Submitting..." : "Submit"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Registration;