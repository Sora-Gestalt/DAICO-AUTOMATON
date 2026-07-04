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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [descModalProject, setDescModalProject] = useState<Project | null>(null);
  
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
  const ksuHoverBlue = "hover:bg-[#004471]";

  const majorFilters = [
    { id: "CS", name: "Computer Science" },
    { id: "IS", name: "Information Systems" },
    { id: "SWE", name: "Software Engineering" },
    { id: "CEN", name: "Computer Engineering" }
  ];

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMajorToggle = (majorId: string) => {
    const currentMajors = formData.majors_needed ? formData.majors_needed.split(', ') : [];
    let newMajors;
    if (currentMajors.includes(majorId)) {
      newMajors = currentMajors.filter(m => m !== majorId);
    } else {
      newMajors = [...currentMajors, majorId];
    }
    setFormData({ ...formData, majors_needed: newMajors.join(', ') });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const nonEnglishRegex = /[^\x00-\x7F]/;
    if (nonEnglishRegex.test(formData.title) || nonEnglishRegex.test(formData.skills_needed)) {
      setError('Project title and skills must be written in English.');
      setIsSubmitting(false);
      return;
    }

    const emailStr = formData.leader_email.trim();
    if (!emailStr.includes('@')) {
      setError('Invalid email address format.');
      setIsSubmitting(false);
      return;
    }
    
    const [localPart, domain] = emailStr.split('@');
    if (domain !== 'student.ksu.edu.sa') {
      setError('Email must end with @student.ksu.edu.sa');
      setIsSubmitting(false);
      return;
    }
    
    if (!localPart.startsWith('4')) {
      setError('Student ID in email must start with 4.');
      setIsSubmitting(false);
      return;
    }
    
    if (localPart.length !== 9 || !/^\d+$/.test(localPart)) {
      setError('Student ID in email must be exactly 9 digits.');
      setIsSubmitting(false);
      return;
    }

    const ksaPhoneRegex = /^05\d{8}$/;
    if (!ksaPhoneRegex.test(formData.leader_phone.trim())) {
      setError('Please provide a valid Saudi mobile number starting with 05 (e.g., 05xxxxxxxx).');
      setIsSubmitting(false);
      return;
    }

    if (!formData.majors_needed) {
      setError('Please select at least one target major.');
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
      
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(false);
      }, 2000);

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
      
      {/* HEADER */}
      <header className={`${ksuBlue} p-5 shadow-sm sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto flex items-center justify-center relative min-h-[60px]">
          <div className="absolute left-0">
             <Image src={ksuLogo} alt="KSU Logo" width={200} height={120} className=' p-1 shadow-sm object-contain' />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight text-center">CCIS Graduation Projects Center</h1>
        </div>
      </header>

      {/* FULL DESCRIPTION MODAL */}
      {descModalProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl relative my-8 animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setDescModalProject(null)} 
              className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
            >
              ✕
            </button>
            <div className="mb-6 border-b border-gray-100 pb-4 pr-8">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-snug">{descModalProject.title}</h2>
              <p className="text-sm font-semibold text-gray-500 mt-2 flex items-center gap-2">
                <span className="bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">Advisor: {descModalProject.advisor}</span>
              </p>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
              {descModalProject.description}
            </div>
            <div className="mt-8 pt-5 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setDescModalProject(null)} 
                className={`${ksuBlue} text-white font-bold py-2.5 px-8 rounded-lg ${ksuHoverBlue} transition-colors shadow-sm`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in duration-200">
            
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors"
            >
              ✕
            </button>

            <div className="mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Project Registration Form</h2>
              <p className="text-sm text-gray-500 mt-1">Publish your proposal variables to discover compatible technical partners.</p>
            </div>

            {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-3.5 rounded-lg mb-5 text-sm font-medium">⚠️ {error}</div>}
            {success && <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-3.5 rounded-lg mb-5 text-sm font-medium">✅ Project published successfully. Closing form...</div>}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 text-sm">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Descriptive Project Title (English Only)</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Concise Abstract (Max 500 chars)</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} required rows={3} maxLength={500} className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Faculty Advisor</label>
                <input type="text" name="advisor" placeholder="e.g., Dr. Ahmad" value={formData.advisor} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Official Email</label>
                <input type="email" name="leader_email" placeholder="@student.ksu.edu.sa" value={formData.leader_email} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Required Skills (English Only)</label>
                <input type="text" name="skills_needed" placeholder="e.g., React, Python" value={formData.skills_needed} onChange={handleInputChange} className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Target Majors</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {majorFilters.map(major => (
                    <label key={major.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded-md transition-colors">
                      <input 
                        type="checkbox" 
                        checked={formData.majors_needed.includes(major.id)} 
                        onChange={() => handleMajorToggle(major.id)} 
                        className="w-4 h-4 text-[#005691] focus:ring-[#005691] border-gray-300 rounded"
                      />
                      <span className="text-gray-700 font-medium text-xs">{major.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Mobile Number</label>
                <input type="tel" name="leader_phone" placeholder="e.g., 05xxxxxxxx" value={formData.leader_phone} onChange={handleInputChange} required className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Alternative Contact (Optional)</label>
                <input type="text" name="contact_misc" placeholder="e.g., Discord or Telegram" value={formData.contact_misc} onChange={handleInputChange} className="w-full p-2.5 bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] transition-all" />
              </div>
              
              <div className="md:col-span-2 pt-6 mt-2 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-100 text-gray-700 font-bold py-2.5 px-6 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={`${ksuBlue} text-white font-bold py-2.5 px-8 rounded-lg ${ksuHoverBlue} transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {isSubmitting ? 'Processing...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto space-y-6 p-6 sm:p-8">
        
        {/* TOP METRICS, FILTERS & ACTION ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center text-center lg:text-left">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Active Recruitment Opportunities</p>
            <p className="text-3xl font-extrabold text-[#005691] mt-1">{projects.length}</p>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <input 
              type="search" 
              placeholder="Search parameters, skills, titles..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full mb-4 p-2.5 px-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005691] text-sm bg-gray-50/50" 
            />
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Target Filters</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedMajorFilter(null)} className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${!selectedMajorFilter ? 'bg-[#005691] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All Positions</button>
                {majorFilters.map(major => (
                  <button 
                    key={major.id} 
                    onClick={() => setSelectedMajorFilter(major.id)} 
                    className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${selectedMajorFilter === major.id ? 'bg-[#005691] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {major.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-sm border border-[#005691]/20 flex flex-col justify-center items-center text-center bg-gradient-to-b from-[#f8fafc] to-white">
             <p className="text-xs text-gray-500 font-medium mb-3">Looking for team members?</p>
             <button 
              onClick={() => setIsModalOpen(true)} 
              className="w-full bg-[#005691] hover:bg-[#004471] text-white py-3 rounded-lg text-sm font-bold shadow-md transition-all whitespace-nowrap"
            >
              + Publish Proposal
            </button>
          </div>
        </div>

        {/* PROJECTS LIST (3 Columns) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="mb-6 pb-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Current Published Projects ({sortedProjects.length})</h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-[#005691]/20 border-t-[#005691] rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-gray-500 font-medium">Querying internal server database parameters...</p>
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="text-center py-16 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm font-bold text-gray-700">No active parameters match your query</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">Modify your filter attributes or search keys to discover other listings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedProjects.map(project => {
                const truncatedDesc = project.description.length > 50 ? project.description.substring(0, 50) + '...' : project.description;

                return (
                  <div key={project.id} className="relative border border-gray-200 bg-white p-5 rounded-xl hover:border-[#005691]/40 shadow-sm transition-all hover:shadow-md group flex flex-col h-full">
                    
                    {/* Hover Buttons */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5 bg-white/90 backdrop-blur p-1 rounded-lg shadow-sm border border-gray-100 z-10">
                      <button onClick={() => handleToggleStatus(project)} className="text-slate-600 bg-slate-50 p-1.5 px-2.5 rounded-md hover:bg-slate-100 text-[10px] font-semibold border border-slate-200" title="Toggle Status">
                        🔄
                      </button>
                      <button onClick={() => handleDelete(project)} className="bg-red-50 text-red-600 p-1.5 px-2.5 rounded-md hover:bg-red-100 text-[10px] font-semibold" title="Withdraw Project">
                        ❌
                      </button>
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 flex flex-col">
                      <div className="flex flex-col gap-2 mb-3 pr-14">
                        <h3 className="text-base font-bold text-gray-900 tracking-tight leading-snug line-clamp-2">{project.title}</h3>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          {project.status === 'Recruiting' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">Recruiting</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">🔒 Full Team</span>
                          )}
                          <span className="text-[11px] text-gray-400 font-mono">{new Date(project.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-[13px] mb-4 leading-relaxed">
                        {truncatedDesc}
                        {project.description.length > 50 && (
                          <button 
                            onClick={() => setDescModalProject(project)} 
                            className="text-[#005691] ml-1 font-semibold text-[11px] hover:underline"
                          >
                            View More
                          </button>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mb-4"><span className="font-semibold text-gray-700">Advisor:</span> {project.advisor}</p>
                      
                      <div className="flex flex-wrap gap-1.5 mb-5 mt-auto">
                        {project.skills_needed && project.skills_needed.split(',').map(skill => (
                          <span key={skill} className="bg-slate-50 text-slate-600 text-[10px] px-2 py-1 rounded-md font-medium border border-slate-200">{skill.trim()}</span>
                        ))}
                        {project.majors_needed && project.majors_needed.split(',').map(major => (
                          <span key={major} className="bg-[#005691]/5 text-[#005691] text-[10px] px-2 py-1 rounded-md font-medium border border-[#005691]/20">{major.trim()}</span>
                        ))}
                      </div>
                    </div>

                    {/* Contact Section Fixed at Bottom */}
                    <div className="border-t border-gray-100 pt-3 mt-auto flex flex-col gap-1.5 text-[11px] text-gray-600 bg-gray-50/50 p-3 rounded-lg border border-gray-100/50">
                      <p className="flex items-center gap-2"><span className="text-gray-400">📧</span> <span className="truncate">{project.leader_email}</span></p>
                      <p className="flex items-center gap-2"><span className="text-gray-400">📞</span> {project.leader_phone}</p>
                      {project.contact_misc && <p className="flex items-center gap-2"><span className="text-gray-400">💬</span> <span className="truncate">{project.contact_misc}</span></p>}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto p-8 text-center text-gray-400 text-xs mt-10 border-t border-gray-200">
        CCIS Student Team Placement Registry Engine • Tailored for King Saud University • Self-Cleaning Active Architecture
      </footer>
    </div>
  );
}
