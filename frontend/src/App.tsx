import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Report } from './pages/Report'
import { PersonManagement } from './pages/PersonManagement'
import { CameraGridPage } from './pages/CameraGridPage'
import { Settings } from './pages/Settings'
import { StudentProfile } from './pages/StudentProfile'
import { GroupManagement } from './pages/GroupManagement'
import { ScheduleManagement } from './pages/ScheduleManagement'
import { Enrollment } from './pages/Enrollment'
import { useSettingsStore } from './store/settingsStore'

function App() {
  const { theme, setTheme } = useSettingsStore()

  // Apply theme on initial load
  useEffect(() => {
    setTheme(theme)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Report />} />
        <Route path="/persons" element={<PersonManagement />} />
        <Route path="/persons/:studentId" element={<StudentProfile />} />
        <Route path="/students" element={<PersonManagement />} />
        <Route path="/groups" element={<GroupManagement />} />
        <Route path="/schedule" element={<ScheduleManagement />} />
        <Route path="/enrollment" element={<Enrollment />} />
        <Route path="/camera-grid" element={<CameraGridPage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

