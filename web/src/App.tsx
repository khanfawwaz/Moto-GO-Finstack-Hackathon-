import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/guards";
import { Spinner } from "./components/ui";

const Welcome = lazy(() => import("./features/onboarding/Welcome"));
const SignUp = lazy(() => import("./features/onboarding/SignUp"));
const Story = lazy(() => import("./features/onboarding/Story"));
const Garage = lazy(() => import("./features/garage/Garage"));
const AddVehicle = lazy(() => import("./features/garage/AddVehicle"));
const VehicleDetail = lazy(() => import("./features/garage/VehicleDetail"));
const Explore = lazy(() => import("./features/explore/Explore"));
const Forum = lazy(() => import("./features/forum/Forum"));
const Passport = lazy(() => import("./features/explore/Passport"));
const Experiences = lazy(() => import("./features/explore/Experiences"));
const RoadTo = lazy(() => import("./features/roadmap/RoadTo"));
const Profile = lazy(() => import("./features/profile/Profile"));
const Insights = lazy(() => import("./features/profile/Insights"));
const Ops = lazy(() => import("./features/profile/Ops"));
const FinanceRoutes = lazy(() => import("./features/finance/FinanceRoutes"));
const MockProvider = lazy(() => import("./features/finance/MockProvider"));

export default function App() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:p-3 focus:font-bold">Skip to content</a>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/mock/:provider" element={<MockProvider />} />
          <Route path="/finance/*" element={<FinanceRoutes />} />

          <Route element={<AppShell />}>
            <Route path="/explore" element={<Explore />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/explore/:modelId" element={<Passport />} />
            <Route path="/capture" element={<Navigate to="/explore#capture" replace />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route element={<RequireAuth />}>
              <Route path="/story" element={<Story />} />
              <Route path="/garage" element={<Garage />} />
              <Route path="/garage/add" element={<AddVehicle />} />
              <Route path="/garage/:id" element={<VehicleDetail />} />
              <Route path="/dream" element={<Navigate to="/garage#dream-garage" replace />} />
              <Route path="/roadmap" element={<ExploreRedirect />} />
              <Route path="/roadmap/compare" element={<Navigate to="/explore" replace />} />
              <Route path="/ownership/:id" element={<RoadTo />} />
              <Route path="/roadmap/goal/:id" element={<RoadTo />} />
              <Route path="/settings" element={<Profile />} />
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="/loans" element={<Insights />} />
              <Route path="/insights" element={<Navigate to="/loans" replace />} />
            </Route>
            <Route element={<RequireAuth role="ops" />}>
              <Route path="/ops" element={<Ops />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function ExploreRedirect() {
  const location = useLocation();
  return <Navigate to={`/explore${location.search}`} replace />;
}
