import React, { useState } from "react";
import { db } from './firebase';
import { collection, addDoc } from "firebase/firestore";

const Registration = () => {
    const [formData, setFormData] = useState({});
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError("");
        setSuccess("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        if (!formData.name || !formData.email || !formData.phone || !formData.age) {
            setError("Please fill in all fields");
            setLoading(false);
            return;
        }

        try {
            // Verify db is initialized
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
            setSuccess("Submitted successfully!");
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

    return (
        <div style={{ padding: 20 }}>
            <h2>Registration Form</h2>
            <form onSubmit={handleSubmit}>
                <input
                    name="name"
                    placeholder="Name"
                    onChange={handleChange}
                    value={formData.name || ''}
                    required
                /><br /><br />
                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    onChange={handleChange}
                    value={formData.email || ''}
                    required
                /><br /><br />
                <input
                    name="phone"
                    placeholder="Phone"
                    onChange={handleChange}
                    value={formData.phone || ''}
                    required
                /><br /><br />
                <input
                    name="age"
                    type="number"
                    placeholder="Age"
                    onChange={handleChange}
                    value={formData.age || ''}
                    required
                /><br /><br />
                <input
                    name="city"
                    type="city"
                    placeholder="City"
                    onChange={handleChange}
                    value={formData.city || ''}
                    required
                /><br /><br />
                <input
                    name="d"
                    type="d"
                    placeholder="D"
                    onChange={handleChange}
                    value={formData.d || ''}
                    required
                /><br /><br />
                <button type="submit" disabled={loading}>
                    {loading ? "Submitting..." : "Submit"}
                </button>
            </form>
            {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
            {success && <div style={{ color: 'green', marginTop: '10px' }}>✓ {success}</div>}
        </div>
    );
};

export default Registration;