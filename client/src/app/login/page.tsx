'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '../../../lib/api';
import { useAuth } from '../../../lib/auth';

const BRANCH_CODES = ['Kathmandu1','Kathmandu2','Pokhara','Bhairawaha'];

export default function LoginPage(){
  const [mode, setMode] = useState<'login' | 'signup'>('login'); // toggle mode
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [branch,setBranch]=useState('Kathmandu1');
  const [err,setErr]=useState('');

  const [trialSignup, setTrialSignup] = useState({
    username: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    branches: '',
  });

  const router = useRouter();
  const { setUser } = useAuth();

  async function submitLogin(){
    try{
      const { data } = await api.post('/auth/login',{ username, password });

      if (!data.user.branches.includes(branch)) {
        setErr('Branch not allowed for this user');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ ...data.user, activeBranch: branch }));

      setUser({ ...data.user, activeBranch: branch });
      router.push('/');
    } catch(e:any){ 
      setErr(e?.response?.data?.message||'Login failed'); 
    }
  }

  async function submitSignup(e:any){
    e.preventDefault();
    try {
      await api.post('/trial-signup', trialSignup);
      alert('✅ Trial signup successful! You will be contacted soon.');
      setTrialSignup({
        username: '',
        email: '',
        phoneNumber: '',
        companyName: '',
        branches: '',
      });
      setMode('login'); // switch back to login after signup
    } catch (err) {
      alert('Error submitting trial signup');
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-indigo-100 to-purple-200 p-4">
      <img
        src="/mahadev-logo.png"
        alt="Mahadev Inn Logo"
        className="w-45 h-40 rounded-full mb-6"
      />

      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        {mode === 'login' ? (
          <>
            <h1 className="text-2xl font-bold text-indigo-700 mb-2 text-center">
              Mahadev Inn — Login
            </h1>
            <p className="text-xs text-slate-500 mb-4 text-center">
              Demo: owner/owner123, manager/manager123, viewer/viewer123
            </p>

            <div className="mb-3">
              <label className="block text-sm font-medium">Username</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                className="border rounded px-3 py-2 w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Branch</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={branch}
                onChange={e=>setBranch(e.target.value)}
              >
                {BRANCH_CODES.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {err && <p className="text-xs text-red-600 mb-2">{err}</p>}

            <button
              onClick={submitLogin}
              className="w-full px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Login
            </button>

            <p 
              className="text-sm text-center text-indigo-600 mt-3 cursor-pointer hover:underline"
              onClick={() => setMode('signup')}
            >
              Don't have an account? Sign up
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-indigo-700 mb-4 text-center">
              Trial Signup — Mahadev Inn SaaS
            </h1>
            <form onSubmit={submitSignup} className="space-y-3">
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Username"
                value={trialSignup.username}
                onChange={(e) => setTrialSignup({...trialSignup, username:e.target.value})}
                required
              />
              <input
                type="email"
                className="border rounded px-3 py-2 w-full"
                placeholder="Email"
                value={trialSignup.email}
                onChange={(e) => setTrialSignup({...trialSignup, email:e.target.value})}
                required
              />
              <input
                type="tel"
                className="border rounded px-3 py-2 w-full"
                placeholder="Phone Number"
                value={trialSignup.phoneNumber}
                onChange={(e) => setTrialSignup({...trialSignup, phoneNumber:e.target.value})}
                required
              />
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Company Name"
                value={trialSignup.companyName}
                onChange={(e) => setTrialSignup({...trialSignup, companyName:e.target.value})}
                required
              />
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Branches (comma separated)"
                value={trialSignup.branches}
                onChange={(e) => setTrialSignup({...trialSignup, branches:e.target.value})}
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Submit Trial Request
              </button>

              <p 
                className="text-sm text-center text-indigo-600 mt-3 cursor-pointer hover:underline"
                onClick={() => setMode('login')}
              >
                Already have an account? Login
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
