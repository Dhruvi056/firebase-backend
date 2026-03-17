import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoc,doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import FormDetails from "../components/FormDetails.jsx";
import Sidebar from "../components/Sidebar.jsx";

export default function Home() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { currentUser ,userMeta} = useAuth();
  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load form from URL parameter
   useEffect(() => {
    if (!formId || !currentUser) {
      setSelectedForm(null);
      return;
    }

    const loadForm = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "forms", formId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          navigate("/", { replace: true });
          return;
        }

        const data = snap.data();

        // Vendor access control
        if (userMeta?.role === "vendor_admin" && userMeta.vendorId && data.vendorId && data.vendorId !== userMeta.vendorId) {
          console.warn("Access denied: vendor mismatch");
          navigate("/", { replace: true });
          return;
        }

        // Regular user access control
        if (userMeta?.role !== "super_admin" && data.userId && data.userId !== currentUser.uid) {
          console.warn("Access denied: user mismatch");
          navigate("/", { replace: true });
          return;
        }

        setSelectedForm({ formId: snap.id, ...data });
      } catch (error) {
        console.error("Error loading form:", error);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [formId, currentUser, userMeta, navigate]);

  const handleSelectForm = (form) => {
    if (form) {
      // Navigate to form URL - the useEffect will load the form
      navigate(`/forms/${form.formId}`, { replace: true });
    } else {
      // Navigate to home
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="w-full h-screen bg-[#f4f5f7] flex gap-6 p-6 overflow-hidden">
      <Sidebar onSelectForm={handleSelectForm} selectedForm={selectedForm} />
      {loading ? (
        <div className="flex-1 h-full flex items-center justify-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : (
        <FormDetails form={selectedForm} />
      )}
    </div>
  );
}
