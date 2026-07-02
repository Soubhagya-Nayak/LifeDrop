import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Droplet, ShieldCheck } from 'lucide-react';

const Login = () => {
    const { login, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const userData = await login(phone.trim(), password);
            if (userData.role !== 'admin') {
                logout();
                setError('Admin access only. Please use the mobile app for donor/patient accounts.');
                return;
            }
            navigate('/');
        } catch {
            setError('Invalid credentials');
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
            <div className="soft-card w-full max-w-md p-8 sm:p-10">
                <div className="text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-blood-dark via-blood-DEFAULT to-blood-light text-white shadow-xl shadow-rose-200">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                            <Droplet size={38} strokeWidth={2.6} />
                        </div>
                    </div>
                    <p className="mt-4 text-sm font-black uppercase tracking-[0.35em] text-blood-DEFAULT">LifeDrop Admin</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                        Admin Login
                    </h2>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                        Admin-only login for monitoring donors, patients, eligibility, and live request locations.
                    </p>
                </div>
                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                    {error && <div className="rounded-2xl bg-rose-50 p-3 text-center text-sm font-semibold text-blood-dark">{error}</div>}
                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Phone number</label>
                            <input
                                name="phone"
                                type="text"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="input"
                                placeholder="Enter your registered phone"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="Enter your password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blood-dark via-blood-DEFAULT to-blood-light py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-rose-200 transition-transform hover:scale-[0.99]"
                    >
                        <ShieldCheck size={18} /> Sign in
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
