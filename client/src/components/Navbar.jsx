import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { DatabaseZap, Droplet, LogOut, Sparkles, User } from 'lucide-react';
import api from '../services/api';

const ADMIN_RESET_EVENT = 'lifedrop-admin-reset-complete';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleResetData = async () => {
        const shouldReset = window.confirm(
            'Reset all donor and receiver data? Admin accounts will be kept, but all requests, donors, and patient records will be erased.'
        );
        if (!shouldReset) return;

        try {
            const res = await api.post('/admin/reset-data');
            window.dispatchEvent(new CustomEvent(ADMIN_RESET_EVENT, { detail: res.data }));
            navigate('/');
            window.alert(res.data?.msg || 'Admin data reset successfully.');
        } catch (err) {
            window.alert(err.response?.data?.msg || 'Unable to reset data.');
        }
    };

    return (
        <nav className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-20">
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blood-light to-blood-dark text-white shadow-lg shadow-rose-200">
                                <Droplet size={26} />
                            </div>
                            <div>
                                <p className="text-xl font-black tracking-tight text-slate-900">LifeDrop</p>
                                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-blood-DEFAULT">
                                    <Sparkles size={12} /> Smart Blood Match
                                </p>
                            </div>
                        </Link>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                {user.role === 'admin' && (
                                    <button
                                        onClick={handleResetData}
                                        className="rounded-full border border-rose-200 bg-white p-3 text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
                                        aria-label="Reset donor and receiver data"
                                        title="Reset donor and receiver data"
                                    >
                                        <DatabaseZap size={20} />
                                    </button>
                                )}
                                <span className="hidden sm:flex items-center rounded-full bg-blood-soft px-4 py-2 text-sm font-bold text-blood-dark">
                                    <User size={16} className="mr-2" />
                                    {user.name} - {user.role}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="rounded-full border border-rose-200 bg-white p-3 text-blood-DEFAULT shadow-sm transition-colors hover:bg-blood-soft"
                                    aria-label="Sign out"
                                >
                                    <LogOut size={20} />
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="rounded-2xl bg-gradient-to-r from-blood-DEFAULT to-blood-light px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-transform hover:scale-[0.98]">Admin Login</Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
