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
import Drivers from "./pages/Drivers";
import Orders from "./pages/Orders";
import Analytics from "./pages/Analytics";
import Layout from "./components/Layout/Layout";
import RestaurantDetail from "./components/Dashboard/RestaurantDetail";

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
          <Route path='/' element={<Navigate to='/dashboard' replace />} />

          <Route
            path='/'
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path='dashboard' element={<Dashboard />} />
            <Route path='restaurants' element={<Restaurants />} />
            <Route path='/restaurants/:id' element={<RestaurantDetail />} />
            <Route path='restaurants/add' element={<AddRestaurant />} />
            <Route path='drivers' element={<Drivers />} />
            <Route path='orders' element={<Orders />} />
            <Route path='analytics' element={<Analytics />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
