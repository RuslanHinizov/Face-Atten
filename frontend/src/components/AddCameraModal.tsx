import { useEffect, useState } from 'react'
import { X, Camera, MapPin, Link as LinkIcon, Plus, Save, Trash2 } from 'lucide-react'
import type { CameraConfig } from '../store/attendanceStore'

export interface AddCameraModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (camera: Omit<CameraConfig, 'id' | 'status'>) => void
    onEdit?: (id: string, updates: Partial<CameraConfig>) => void
    onDelete?: (id: string) => void
    initialData?: CameraConfig | null
}

export function AddCameraModal({ isOpen, onClose, onAdd, onEdit, onDelete, initialData }: AddCameraModalProps) {
    const [name, setName] = useState('')
    const [location, setLocation] = useState('')
    const [rtspUrl, setRtspUrl] = useState('')

    const isEdit = !!initialData

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name)
            setLocation(initialData.location)
            setRtspUrl(initialData.rtspUrl || '')
        } else if (isOpen) {
            setName('')
            setLocation('')
            setRtspUrl('')
        }
    }, [isOpen, initialData])

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (isEdit && onEdit && initialData) {
            onEdit(initialData.id, { name, location, rtspUrl })
        } else {
            onAdd({
                name: name || 'New Camera',
                location: location || 'Unknown',
                rtspUrl
            })
        }
        onClose()
    }

    const handleDelete = () => {
        if (initialData && onDelete && window.confirm('Are you sure you want to delete this camera?')) {
            onDelete(initialData.id)
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/30">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">
                            {isEdit ? 'Edit Camera' : 'Add New Camera'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Camera Name</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Main Hall Camera"
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                autoFocus
                            />
                            <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Location / Room</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g. Room 101"
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">RTSP Stream URL (Optional)</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={rtspUrl}
                                onChange={(e) => setRtspUrl(e.target.value)}
                                placeholder="rtsp://admin:password@192.168.1.10..."
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 pl-10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                {isEdit ? 'Save Changes' : 'Add Camera'}
                            </button>
                        </div>

                        {isEdit && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="w-full px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-medium border border-rose-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Camera
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
