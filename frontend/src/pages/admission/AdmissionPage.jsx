// frontend/src/pages/admission/AdmissionPage.jsx
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function AdmissionPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/ipd", { replace: true })
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <p className="text-gray-400 text-sm">Redirecting to IPD...</p>
    </div>
  )
}