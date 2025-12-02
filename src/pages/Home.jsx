import { useState } from "react";
import FormDetails from "../components/FormDetails.jsx";
import Sidebar from "../components/Sidebar.jsx";

export default function Home() {
  const [selectedForm, setSelectedForm] = useState(null);

  return (
    <div className="w-full h-screen bg-[#f4f5f7] flex gap-6 p-6 overflow-hidden">
      <Sidebar onSelectForm={setSelectedForm} selectedForm={selectedForm} />
      <FormDetails form={selectedForm} />
    </div>
  );
}
