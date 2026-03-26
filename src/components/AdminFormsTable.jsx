import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function AdminFormsTable() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersById, setUsersById] = useState({});
  const [usersByVendorId, setUsersByVendorId] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [foldersById, setFoldersById] = useState({});
  //const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
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

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "folders"),
      (snap) => {
        const map = {};
        snap.forEach((d) => {
          map[d.id] = d.data() || {};
        });
        setFoldersById(map);
      },
      (err) => {
        console.error("AdminFormsTable: error fetching folders", err);
        setFoldersById({});
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
    const pretty = String(role).replace(/_/g, " ");
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  };

  const getFormVendorName = useCallback((f) => {
    return (
      usersById?.[f.vendorId]?.name ||
      usersByVendorId?.[f.vendorId]?.name ||
      usersById?.[f.userId]?.name ||
      usersById?.[f.vendorId]?.email ||
      usersByVendorId?.[f.vendorId]?.email ||
      usersById?.[f.userId]?.email ||
      f.vendorId ||
      "-"
    );
  }, [usersById, usersByVendorId]);
  const filteredForms = useMemo(() => {
    let result = forms.filter((f) => {
      const vendorName = getFormVendorName(f).toLowerCase();
      const userName = (usersById?.[f.userId]?.name || "").toLowerCase();
      const userEmail = (usersById?.[f.userId]?.email || "").toLowerCase();
      const userRole = usersById?.[f.userId]?.role || "vendor_admin";
      const formName = (f.name || "").toLowerCase();
      const formId = (f.formId || "").toLowerCase();
      const folderName = (foldersById?.[f.folderId]?.name || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const searchMatch =
        formName.includes(search) ||
        formId.includes(search) ||
        userName.includes(search) ||
        userEmail.includes(search) ||
        vendorName.includes(search) ||
        folderName.includes(search);

      //const vendorMatch = selectedVendor === "all" || f.vendorId === selectedVendor;
      const roleMatch = selectedRole === "all" || userRole === selectedRole;

      return searchMatch  && roleMatch;
    });

    result.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [forms, searchTerm, selectedRole, sortOrder, foldersById, getFormVendorName, usersById]);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <h5 className="mb-1 fw-bold">All Forms</h5>
            <p className="text-muted small mb-0">Manage and oversee all platform forms</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
              {loading ? "Loading..." : `${filteredForms.length} shown`}
            </span>
            {searchTerm ||  selectedRole !== "all" ? (
              <button 
                className="btn btn-link btn-sm text-muted p-0 text-decoration-none"
                onClick={() => {
                  setSearchTerm("");
                //  setSelectedVendor("all");
                  setSelectedRole("all");
                  setSortOrder("newest");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="row g-3 mb-4 bg-body-tertiary p-3 rounded-3 mx-0">
          <div className="col-12 col-md-4">
            <label className="form-label small fw-bold text-secondary">Search</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0">
                  <i className="text-muted" data-feather="search" style={{ width: '14px' }}></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Name, ID, User..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

          <div className="col-6 col-md-4">
           <label className="form-label small fw-bold text-secondary">Filter by Role</label>
            <select
              className="form-select form-select-sm"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="vendor_admin">Vendor Admin</option>
            </select>
          </div>

          <div className="col-6 col-md-4">
            <label className="form-label small fw-bold text-secondary">Sort Order</label>
              <select
                className="form-select form-select-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
            >
               <option value="newest">Newest First</option>
               <option value="oldest">Oldest First</option>
              </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-body-tertiary">
              <tr>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Form</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Folder</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">User</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Role</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Vendor</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredForms.map((f) => (
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
                    {f.name || "-"}
                  </td>
                  <td className="text-muted">
                    {foldersById[f.folderId]?.name || f.folderId || "-"}
                  </td>
                  <td className="text-muted">
                    {usersById?.[f.userId]?.email || f.userId || "-"}
                  </td>
                  <td className="text-muted">
                    <span className={`badge ${usersById?.[f.userId]?.role === 'super_admin' ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info'} px-2 py-1 rounded`}>
                      {formatRoleLabel(usersById?.[f.userId]?.role || 'vendor_admin')}
                    </span>
                  </td>
                   <td className="text-muted">
                    {getFormVendorName(f)}
                  </td>
                  <td className="text-muted">{createdAtText(f.createdAt)}</td>
                </tr>
              ))}
              {filteredForms.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-5">
                    <div className="d-flex flex-column align-items-center">
                      <i className="mb-2 opacity-25" data-feather="search" style={{ width: '48px', height: '48px' }}></i>
                      <span>No forms match your search criteria.</span>
                    </div>
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

