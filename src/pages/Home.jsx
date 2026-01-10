import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import FormDetails from "../components/FormDetails.jsx";
import Sidebar from "../components/Sidebar.jsx";

export default function Home() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load form from URL parameter
  useEffect(() => {
    if (formId && currentUser) {
      setLoading(true);
      const loadForm = async () => {
        try {
          const formsRef = collection(db, "forms");
          const q = query(
            formsRef,
            where("userId", "==", currentUser.uid)
          );
          const querySnapshot = await getDocs(q);
          
          const form = querySnapshot.docs
            .map((doc) => ({
              formId: doc.id,
              ...doc.data(),
            }))
            .find((f) => f.formId === formId);

          if (form) {
            setSelectedForm(form);
          } else {
            // Form not found, redirect to home
            navigate("/", { replace: true });
          }
        } catch (error) {
          console.error("Error loading form:", error);
          navigate("/", { replace: true });
        } finally {
          setLoading(false);
        }
      };
      loadForm();
    } else if (!formId) {
      // No formId in URL, clear selection
      setSelectedForm(null);
    }
  }, [formId, currentUser, navigate]);

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
