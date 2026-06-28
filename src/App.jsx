import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import Mistakes from './pages/Mistakes'
import Upload from './pages/Upload'
import QuestionBanks from './pages/QuestionBanks'
import Login from './pages/Login'
import Admin from './pages/Admin'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/banks" element={<QuestionBanks />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/mistakes" element={<Mistakes />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
