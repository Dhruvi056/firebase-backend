import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function AdminFormsTable() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersById, setUsersById] = useState({});
  const [usersByVendorId, setUsersByVendorId] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "forms"),
      (snap) => {
        const arr = snap.docs.map((d) => ({
          formId: d.id,
          ...(d.data() || {}),
        }));
        setForms(arr);
        setLoading(false);
      },
      (err) => {
        console.error("AdminFormsTable: error fetching forms", err);
        setForms([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Map users uid -> user document (name)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const map = {};
        const mapByVendor = {};
        snap.forEach((d) => {
          const data = d.data() || {};
          map[d.id] = data;
          // In many places forms.vendorId stores vendorId (not uid),
          // so also index by users/{uid}.vendorId when present.
          const vendorKey = data.vendorId || d.id;
          mapByVendor[vendorKey] = data;
        });
        setUsersById(map);
        setUsersByVendorId(mapByVendor);
      },
      (err) => {
        console.error("AdminFormsTable: error fetching users", err);
        setUsersById({});
        setUsersByVendorId({});
      }
    );
    return () => unsub();
  }, []);

  const createdAtText = (value) => {
    try {
      if (value?.toDate) return value.toDate().toLocaleString();
      if (value) return String(value);
      return "-";
    } catch {
      return "-";
    }
  };

  const formatRoleLabel = (role) => {
    if (!role) return "-";
    // "vendor_admin" -> "Vendor admin" (UI-friendly)
    const pretty = String(role).replace(/_/g, " ");
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  };

  const totalCount = useMemo(() => forms.length, [forms.length]);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h5 className="mb-1 fw-bold">All Forms</h5>
            <p className="text-muted small mb-0">Every form across the platform</p>
          </div>
          <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
            {loading ? "Loading..." : `${totalCount} forms`}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-body-tertiary">
              <tr>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Form</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Folder</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">User</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Vendor</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Created</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr
                  key={f.formId}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/forms/${f.formId}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(`/forms/${f.formId}`);
                  }}
                >
                  <td className="fw-semibold">
                    <div className="d-flex flex-column">
                      <span>{f.name || "-"}</span>
                      <span className="text-muted" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "12px" }}>
                        {f.formId}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {f.folderId || "None"}
                  </td>
                  <td className="text-muted" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {usersById?.[f.userId]?.email || f.userId || "-"}
                  </td>
                  <td className="text-muted" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {formatRoleLabel(
                      usersById?.[f.vendorId]?.role ||
                        usersByVendorId?.[f.vendorId]?.role ||
                        usersById?.[f.userId]?.role
                    )}
                  </td>
                  <td className="text-muted">{createdAtText(f.createdAt)}</td>
                </tr>
              ))}
              {forms.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    No forms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

