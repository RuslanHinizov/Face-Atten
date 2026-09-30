import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Move,
    ZoomIn,
    ZoomOut,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Filter,
    Activity,
    WifiOff,
    Settings
} from 'lucide-react'
import type { Camera } from './CameraTile'

import { ClassroomStats } from './ClassroomStats'
import { EventLog } from './EventLog'

interface CameraControlPanelProps {
    selectedCamera: Camera | null
    onFilterChange: (filter: 'all' | 'offline' | 'motion') => void
    activeFilter: 'all' | 'offline' | 'motion'
    onEditClick?: (camera: Camera) => void
}

export function CameraControlPanel({ selectedCamera, onFilterChange, activeFilter, onEditClick }: CameraControlPanelProps) {
    const { t } = useTranslation()
    const [zoomLevel, setZoomLevel] = useState(1)

    return (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-6 h-full min-h-[600px] w-full lg:w-80 transition-all duration-300 overflow-hidden shadow-2xl">

            {/* PTZ Controls or Stats Header */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-300 font-semibold border-b border-slate-700/50 pb-2">
                    <Move className="w-4 h-4 text-indigo-400" />
                    <span>{t('dashboard.controls.ptz')}</span>
                </div>

                {selectedCamera ? (
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="flex items-center justify-between w-full px-2">
                            <div className="text-xs text-slate-500 font-medium">
                                {selectedCamera.name} Selected
                            </div>
                            {onEditClick && (
                                <button
                                    onClick={() => onEditClick(selectedCamera)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-all border border-slate-700/50"
                                    title="Edit Camera"
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* D-Pad */}
                        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-800/50 rounded-full border border-slate-700/50 relative">
                            <div className="col-start-2">
                                <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-indigo-600 text-slate-300 active:text-white transition-colors">
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="col-start-1 row-start-2">
                                <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-indigo-600 text-slate-300 active:text-white transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="col-start-2 row-start-2 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            </div>
                            <div className="col-start-3 row-start-2">
                                <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-indigo-600 text-slate-300 active:text-white transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="col-start-2 row-start-3">
                                <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-indigo-600 text-slate-300 active:text-white transition-colors">
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Zoom Slider */}
                        <div className="w-full space-y-2 px-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <ZoomOut className="w-3 h-3" />
                                <span>{t('dashboard.controls.zoom')}: {zoomLevel.toFixed(1)}x</span>
                                <ZoomIn className="w-3 h-3" />
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.1"
                                value={zoomLevel}
                                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all hover:[&::-webkit-slider-thumb]:scale-125"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-sm italic">
                        {t('dashboard.controls.select')}
                    </div>
                )}
            </div>

            {/* Contextual Stats and Events - Only visible when camera selected */}
            {selectedCamera && (
                <>
                    <hr className="border-slate-800" />

                    {/* Integrated Classroom Stats */}
                    <ClassroomStats variant="sidebar" />

                    <hr className="border-slate-800" />

                    {/* Integrated Event Log */}
                    <EventLog variant="sidebar" cameraId={selectedCamera.id} />
                </>
            )}

            {/* Filters */}
            <div className="mt-auto space-y-3 pt-4 border-t border-slate-800/50">
                <div className="flex items-center gap-2 text-slate-300 font-semibold border-b border-slate-700/50 pb-2">
                    <Filter className="w-4 h-4 text-emerald-400" />
                    <span>{t('dashboard.controls.filters')}</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <button
                        onClick={() => onFilterChange('all')}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'all'
                            ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white border-l-2 border-indigo-500'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {t('dashboard.controls.all')}
                    </button>

                    <button
                        onClick={() => onFilterChange('motion')}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'motion'
                            ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white border-l-2 border-amber-500'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                    >
                        <Activity className="w-3.5 h-3.5 text-amber-500" />
                        {t('dashboard.controls.motion')}
                    </button>

                    <button
                        onClick={() => onFilterChange('offline')}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'offline'
                            ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white border-l-2 border-rose-500'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                    >
                        <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                        {t('dashboard.controls.offline')}
                    </button>
                </div>
            </div>
        </div>
    )
}
