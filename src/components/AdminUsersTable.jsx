import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";
import "../styles/components/admin-users-actions.css";

export default function AdminUsersTable() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("vendor_admin");
  const [draftVendorId, setDraftVendorId] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);

  const totalCount = useMemo(() => users.length, [users.length]);

  const LucideIcon = ({ name, className = "", style = {} }) => {
    useEffect(() => {
      if (window.lucide) window.lucide.createIcons();
    }, [name]);

    return (
      <span
        className={`d-inline-flex align-items-center justify-content-center ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}"></i>` }}
      />
    );
  };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const arr = snap.docs
          .map((d) => ({
            uid: d.id,
            ...(d.data() || {}),
          }))
          .filter((u) => u.role !== "super_admin");
        setUsers(arr);
        setLoading(false);
      },
      (err) => {
        console.error("AdminUsersTable: error fetching users", err);
        setUsers([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h5 className="mb-1 fw-bold">Vendor Admins</h5>
            <p className="text-muted small mb-0">All registered vendor accounts</p>
          </div>
          <span className="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill">
            {loading ? "Loading..." : `${totalCount} users`}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-body-tertiary">
              <tr>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Name</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Email</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Role</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0">Vendor ID</th>
                <th className="text-uppercase fs-11px fw-bold text-secondary border-0 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td className="fw-semibold">{u.name || "-"}</td>
                  <td>{u.email || "-"}</td>
                  <td className="text-capitalize">{(u.role || "admin").replace("_", " ")}</td>
                  <td className="text-muted" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {u.vendorId || "-"}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary me-2 admin-user-action-btn"
                      onClick={() => {
                        setEditingUser(u);
                        setDraftName(u.name || "");
                        setDraftRole(u.role === "super_admin" ? "super_admin" : "vendor_admin");
                        setDraftVendorId(u.vendorId || "");
                        setShowEditModal(true);
                      }}
                      title="Edit user"
                    >
                      <LucideIcon name="pencil" className="icon-sm" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger admin-user-action-btn"
                      onClick={async () => {
                        const ok = window.confirm("Delete this user meta document? (Auth account will not be deleted)");
                        if (!ok) return;
                        try {
                          await deleteDoc(doc(db, "users", u.uid));
                          toast.success("User deleted (meta).");
                        } catch (err) {
                          console.error("Delete user failed:", err);
                          toast.error("Failed to delete user.");
                        }
                      }}
                      title="Delete user"
                    >
                      <LucideIcon name="trash-2" className="icon-sm" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && editingUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1200 }}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header">
                <h5 className="modal-title">Edit User</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)} />
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!editingUser?.uid) return;
                  setEditingSaving(true);
                  try {
                    const name = draftName.trim();
                    const vendorId = draftVendorId.trim();
                    await updateDoc(doc(db, "users", editingUser.uid), {
                      name,
                      role: draftRole === "super_admin" ? "super_admin" : "vendor_admin",
                      vendorId,
                    });
                    toast.success("User updated.");
                    setShowEditModal(false);
                  } catch (err) {
                    console.error("Update user failed:", err);
                    toast.error("Failed to update user.");
                  } finally {
                    setEditingSaving(false);
                  }
                }}
              >
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Email</label>
                    <input type="email" className="form-control" value={editingUser.email || ""} disabled />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Role</label>
                    <select className="form-select" value={draftRole} onChange={(e) => setDraftRole(e.target.value)}>
                      <option value="vendor_admin">vendor_admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Vendor ID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={draftVendorId}
                      onChange={(e) => setDraftVendorId(e.target.value)}
                      placeholder="e.g. uid / vendorId"
                    />
                  </div>
                </div>

                <div className="modal-footer border-top-0 pt-0">
                  <button type="button" className="btn btn-light px-4" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary px-4" disabled={editingSaving}>
                    {editingSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

