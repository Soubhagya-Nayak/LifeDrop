import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building2, Droplet, HeartHandshake, UserRoundPlus } from 'lucide-react';

const Register = () => {
    const { register, login } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        password: '',
        blood_group: 'A+',
        aadhaar_number: '',
        aadhaar_document_name: '',
        aadhaar_document_uri: '',
        latitude: 19.0760, // Example Default
        longitude: 72.8777,
        role: 'donor'
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await register(formData);
            await login(formData.phone, formData.password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.msg || 'Registration failed');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAadhaarFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFormData({
            ...formData,
            aadhaar_document_name: file.name,
            aadhaar_document_uri: `browser-upload://${file.name}`,
        });
    };

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-10">
            <div className="soft-card w-full max-w-2xl p-8 sm:p-10">
                <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-200">
                        <Droplet size={34} />
                    </div>
                    <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">
                        Create your LifeDrop account
                    </h2>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                        Join as a donor or hospital and start matching urgent blood needs.
                    </p>
                </div>
                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                    {error && <div className="rounded-2xl bg-rose-50 p-3 text-center text-sm font-semibold text-blood-dark">{error}</div>}

                    <div className="grid gap-4 md:grid-cols-2">
                        <input name="name" type="text" onChange={handleChange} required className="input" placeholder="Full name" />
                        <input name="phone" type="text" onChange={handleChange} required className="input" placeholder="Phone number" />
                    </div>
                    <input name="password" type="password" onChange={handleChange} required className="input" placeholder="Create password" />
                    <input name="aadhaar_number" type="text" maxLength={12} value={formData.aadhaar_number} onChange={handleChange} required className="input" placeholder="12-digit Aadhaar number" />
                    <label className="block rounded-3xl border border-dashed border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-slate-700 cursor-pointer">
                        <span className="block text-xs font-black uppercase tracking-[0.2em] text-blood-DEFAULT">Upload Aadhaar Card</span>
                        <span className="mt-1 block text-slate-500">{formData.aadhaar_document_name || 'Choose PDF/JPG/PNG file'}</span>
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleAadhaarFileChange} required />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                        <select name="blood_group" onChange={handleChange} className="input" value={formData.blood_group}>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                <option key={bg} value={bg}>{bg}</option>
                            ))}
                        </select>

                        <select name="role" onChange={handleChange} className="input" value={formData.role}>
                            <option value="donor">Donor</option>
                            <option value="hospital">Hospital</option>
                        </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-3xl bg-rose-50 p-4 text-sm font-semibold text-slate-600">
                            <HeartHandshake className="mb-2 text-blood-DEFAULT" size={20} />
                            Donors receive compatible requests and can instantly accept nearby emergencies.
                        </div>
                        <div className="rounded-3xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                            <Building2 className="mb-2 text-slate-700" size={20} />
                            Hospitals can create requests, track donor responses, and manage case status.
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blood-dark via-blood-DEFAULT to-blood-light py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-rose-200 transition-transform hover:scale-[0.99]"
                    >
                        <UserRoundPlus size={18} /> Create Account
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Register;
