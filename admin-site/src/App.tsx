import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Restaurants from "./pages/Restaurants";
import AddRestaurant from "./pages/AddRestaurant";
import RestaurantDetail from "./components/Dashboard/RestaurantDetail";
import AddMenuItem from "./pages/AddMenuItem";
import Drivers from "./pages/Drivers";
import Orders from "./pages/Orders";
``;
// import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Layout from "./components/Layout/Layout";

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='text-lg'>Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to='/login' />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path='/login' element={<Login />} />

          {/* Protected Routes */}
          <Route
            path='/'
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to='/dashboard' replace />} />
            <Route path='dashboard' element={<Dashboard />} />

            {/* Restaurant Routes */}
            <Route path='restaurants'>
              <Route index element={<Restaurants />} />
              <Route path='add' element={<AddRestaurant />} />
              <Route path=':id'>
                <Route index element={<RestaurantDetail />} />
                <Route path='menu/add' element={<AddMenuItem />} />
                <Route path='edit' element={<AddRestaurant />} />
              </Route>
            </Route>

            <Route path='drivers' element={<Drivers />} />
            <Route path='orders' element={<Orders />} />
            {/* <Route path='analytics' element={<Analytics />} /> */}
            <Route path='settings' element={<Settings />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path='*' element={<Navigate to='/dashboard' replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
