import { useState, useRef, useEffect } from "react"
import { Bell, ChevronDown, LogOut, User } from "lucide-react"
import useAuthStore from "../../store/authStore"

const Navbar = ({ collapsed }) => {
  const { user, logout } = useAuthStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [time, setTime] = useState(new Date())
  const dropRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <nav className={`fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 transition-all duration-300 ${collapsed ? "left-16" : "left-64"}`}>
      <div>
        <h2 className="font-semibold text-gray-800 text-sm">St. Everest Mediplex</h2>
        <p className="text-gray-400 text-xs">Hospital Information Management System</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-gray-700">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-xs text-gray-400">
            {time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <button className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-700 leading-tight">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 leading-tight">{user?.role?.replace(/_/g, " ")}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <User className="w-4 h-4 text-gray-400" /> My Profile
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-xl"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
