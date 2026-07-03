'use client';

import { useState, useEffect, FormEvent } from 'react';
import Image from "next/image";
import ksuLogo from "../public/ksu_masterlogo_colour_rgb.png";

interface Project {
  id: number;
  title: string;
  description: string;
  skills_needed: string;
  majors_needed: string;
  advisor: string;
  leader_email: string;
  leader_phone: string;
  contact_misc?: string;
  status: 'Recruiting' | 'Full Team';
  created_at: string;
}

export default function Home() {
  const [formData, setFormData] = useState({
    title: '', description: '', skills_needed: '', majors_needed: '',
    advisor: '', leader_email: '', leader_phone: '', contact_misc: '',
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMajorFilter, setSelectedMajorFilter] = useState<string | null>(null);

  const ksuBlue = "bg-[#005691]";
  const ksuBlueText = "text-[#005691]";
  const ksuHoverBlue = "hover:bg-[#004471]";

  const ccisMajors = ["CS", "IS", "SWE", "CEN"];

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError('Could not load projects. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const ksuEmailRegex = /^[a-zA-Z0-9._%+-]+@student\.ksu\.edu\.sa$/;
    if (!ksuEmailRegex.test(formData.leader_email.trim())) {
      setError('Only official KSU student emails (@student.ksu.edu.sa) are permitted.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Submission failed.');

      setSuccess(true);
      setFormData({
        title: '', description: '', skills_needed: '', majors_needed: '',
        advisor: '', leader_email: '', leader_phone: '', contact_misc: '',
      });
      fetchProjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (project: Project) => {
    const nextStatus = project.status === 'Recruiting' ? 'Full Team' : 'Recruiting';
    if (!confirm(`Change listing designation status to "${nextStatus}"?`)) return;

    try {
      const res = await fetch('/api/projects/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leader_email: project.leader_email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP dispatch error');

      const executeStatusVerification = async (messagePrompt: string) => {
        const userOtp = prompt(messagePrompt);
        if (!userOtp) return;

        const updateRes = await fetch('/api/projects/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leader_email: project.leader_email.trim(),
            otp: userOtp.trim(),
            newStatus: nextStatus
          }),
        });

        const updateData = await updateRes.json();

        if (!updateRes.ok) {
          if (updateRes.status === 401) {
            await executeStatusVerification(`⚠️ Entry Denied.\n\n${updateData.error}\n\nEnter the correct 6-digit pin:`);
          } else {
            throw new Error(updateData.error || 'Clearance validation rejected.');
          }
        } else {
          alert(`✅ Selection modified successfully to ${nextStatus}.`);
          fetchProjects();
        }
      };

      await executeStatusVerification(
        `🔒 Security Code dispatched to: ${project.leader_email}\n\nEnter the 6-digit pin from your terminal console to change status fields:`
      );
    } catch (err: any) {
      alert(`⚠️ Update Denied: ${err.message}`);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Initialize deletion sequence for "${project.title}"?`)) return;

    try {
      const res = await fetch('/api/projects/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leader_email: project.leader_email }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP generation failed');

      const executeVerificationSequence = async (messagePrompt: string) => {
        const userOtp = prompt(messagePrompt);
        if (!userOtp) return;

        const deleteRes = await fetch('/api/projects/delete-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: project.leader_email.trim(),
            otp: userOtp.trim()
          }),
        });

        const deleteData = await deleteRes.json();

        if (!deleteRes.ok) {
          if (deleteRes.status === 401) {
            await executeVerificationSequence(`⚠️ Entry Denied.\n\n${deleteData.error}\n\nEnter the correct 6-digit pin:`);
          } else {
            throw new Error(deleteData.error || 'Verification clearance rejected');
          }
        } else {
          alert('✅ Verification verified. Record permanently removed from database.');
          fetchProjects();
        }
      };

      await executeVerificationSequence(
        `🔒 Security Code requested for: ${project.leader_email}\n\nCheck your system server console window to copy your 6-digit pin:`
      );

    } catch (err: any) {
      alert(`⚠️ Action Blocked: ${err.message}`);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.skills_needed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.majors_needed.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMajorFilter = selectedMajorFilter 
      ? project.majors_needed.toLowerCase().includes(selectedMajorFilter.toLowerCase())
      : true;

    return matchesSearch && matchesMajorFilter;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (!searchTerm.trim()) return 0;

    const searchKeywords = searchTerm.toLowerCase().split(/[ ,]+/);

    const scoreA = searchKeywords.filter(k => a.skills_needed.toLowerCase().includes(k)).length;
    const scoreB = searchKeywords.filter(k => b.skills_needed.toLowerCase().includes(k)).length;

    return scoreB - scoreA; 
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-gray-900 antialiased">
      <header className={`${ksuBlue} p-5 shadow-sm`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             {/* 🔄 CHANGED: Replaced hardcoded string with imported ksuLogo object */}
             <Image src={ksuLogo} alt="KSU Logo" width={46} height={46} className='bg-white p-1 rounded-full shadow-sm object-contain' />
             <h1 className="text-xl font-bold text-white tracking-tight">CCIS Graduation Project Marketplace</h1>
          </div>
          <span className="text-white/90 text-sm font-medium tracking-wide bg-white/10 px-3 py-1 rounded-full">KSU Internal Portal</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 p-8">
        <section className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Project Registration Form</h2>
              <p className="text-xs text-gray-500 mt-1">Publish your proposal variables to discover compatible technical partners.</p>
            </div>

            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3.5 rounded-lg mb-5 text-xs font-medium">⚠️ {error}</div>}
            {success && <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-3.5 rounded-lg mb-5 text-xs font-medium">✅ Project published successfully to the registry.</div>}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Project Overview</label>
                <input type="text" name="title" placeholder="Descriptive Project Title" value={formData.title} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div>
                <textarea name="description" placeholder="Provide a concise abstract of the core objectives and technical stack (max 300 characters)..." value={formData.description} onChange={handleInputChange} required rows={3} maxLength={300} className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Academic Supervision</label>
                <input type="text" name="advisor" placeholder="Assigned Faculty Advisor (e.g., Dr. Ahmad)" value={formData.advisor} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Requirements Synergy</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" name="skills_needed" placeholder="Skills (React, Python)" value={formData.skills_needed} onChange={handleInputChange} className="p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
                  <input type="text" name="majors_needed" placeholder="Majors (SWE, CS)" value={formData.majors_needed} onChange={handleInputChange} className="p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Primary Administrative Contact</label>
                <div className="space-y-2">
                  <input type="email" name="leader_email" placeholder="Official Email (@student.ksu.edu.sa)" value={formData.leader_email} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
                  <input type="tel" name="leader_phone" placeholder="Contact Mobile Link (e.g., 05xxxxxxxx)" value={formData.leader_phone} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
                  <input type="text" name="contact_misc" placeholder="Alternative Contact Alias (Optional, e.g., Discord)" value={formData.contact_misc} onChange={handleInputChange} className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
                </div>
              </div>
              
              <button type="submit" disabled={isSubmitting} className={`w-full ${ksuBlue} text-white font-medium py-2.5 px-4 rounded-lg ${ksuHoverBlue} transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2`}>
                {isSubmitting ? 'Processing Transaction...' : 'Publish Proposal Listing'}
              </button>
            </form>
          </div>
        </section>

        <section className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Capstone Proposals</p>
              <p className="text-2xl font-extrabold text-[#005691] mt-0.5">{projects.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aggregated Major Allocations</p>
              <div className="flex gap-1.5 mt-1.5">
                {ccisMajors.map(m => (
                  <span key={m} className="text-[10px] bg-slate-100 font-semibold px-1.5 py-0.5 rounded text-slate-600">{m}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-bold text-gray-900">Current Marketplace Liquidity ({sortedProjects.length})</h2>
              <input type="search" placeholder="Search parameters..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 px-4 border border-gray-200 rounded-full w-full sm:w-60 focus:outline-none focus:ring-2 focus:ring-[#005691] text-sm" />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mb-6 pb-4 border-b border-gray-100">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Target Filters:</span>
              <button onClick={() => setSelectedMajorFilter(null)} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${!selectedMajorFilter ? 'bg-[#005691] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All Positions</button>
              {ccisMajors.map(major => (
                <button key={major} onClick={() => setSelectedMajorFilter(major)} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${selectedMajorFilter === major ? 'bg-[#005691] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{major}</button>
              ))}
            </div>

            {loading ? (
              <p className="text-center py-10 text-xs text-gray-400 animate-pulse">Querying internal server database parameters...</p>
            ) : sortedProjects.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-2xl mb-1">🔍</p>
                <p className="text-xs font-semibold text-gray-700">No active parameters match your query</p>
                <p className="text-[11px] text-gray-400 max-w-xs mx-auto mt-0.5">Modify your filter attributes or search keys to discover other listings.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedProjects.map(project => (
                  <div key={project.id} className="relative border border-gray-100 bg-white p-5 rounded-xl hover:border-gray-200 shadow-sm transition-all hover:shadow-md group">
                    
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5 bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                      <button onClick={() => handleToggleStatus(project)} className="text-slate-600 bg-slate-50 p-1 px-2 rounded-md hover:bg-slate-100 text-[10px] font-semibold border border-slate-200">
                        Toggle Status
                      </button>
                      <button onClick={() => handleDelete(project)} className="bg-red-50 text-red-600 p-1 px-2 rounded-md hover:bg-red-100 text-[10px] font-semibold">
                        Withdraw
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2.5 pr-28">
                      <h3 className="text-base font-bold text-gray-900 tracking-tight">{project.title}</h3>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        {project.status === 'Recruiting' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Recruiting</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">🔒 Full Team</span>
                        )}
                        <span className="text-[11px] text-gray-400 font-mono">{new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-xs mb-3.5 leading-relaxed">{project.description}</p>
                    <p className="text-xs text-gray-500 mb-4"><span className="font-semibold text-gray-700">Project Advisor:</span> {project.advisor}</p>
                    
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {project.skills_needed && project.skills_needed.split(',').map(skill => (
                        <span key={skill} className="bg-slate-50 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-medium border border-slate-100">{skill.trim()}</span>
                      ))}
                      {project.majors_needed && project.majors_needed.split(',').map(major => (
                        <span key={major} className="bg-[#005691]/5 text-[#005691] text-[10px] px-2 py-0.5 rounded-md font-medium border border-[#005691]/10">{major.trim()}</span>
                      ))}
                    </div>

                    <div className="border-t border-gray-100 pt-3.5 mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-gray-500 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
                      <p><span className="font-medium text-gray-700">📧 Email:</span> {project.leader_email}</p>
                      <p><span className="font-medium text-gray-700">📞 Mobile:</span> {project.leader_phone}</p>
                      {project.contact_misc && <p><span className="font-medium text-gray-700">💬 Alternate:</span> {project.contact_misc}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto p-8 text-center text-gray-400 text-xs mt-10 border-t border-gray-200">
        CCIS Student Team Placement Registry Engine • Tailored for King Saud University • Self-Cleaning Active Architecture
      </footer>
    </div>
  );
}