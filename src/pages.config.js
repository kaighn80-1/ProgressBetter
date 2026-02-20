/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ChangePassword from './pages/ChangePassword';
import DeliveryNotes from './pages/DeliveryNotes';
import Fixings from './pages/Fixings';
import FullStockTake from './pages/FullStockTake';
import Operations from './pages/Operations';
import PartialStockTake from './pages/PartialStockTake';
import PinVerification from './pages/PinVerification';
import ProjectDetail from './pages/ProjectDetail';
import Projects from './pages/Projects';
import Reports from './pages/Reports';
import Requirements from './pages/Requirements';
import Sections from './pages/Sections';
import SetupPin from './pages/SetupPin';
import FullStockTakeReport from './pages/FullStockTakeReport';
import Dashboard from './pages/Dashboard';
import MyWIP from './pages/MyWIP';
import Scan from './pages/Scan';
import Parts from './pages/Parts';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ChangePassword": ChangePassword,
    "DeliveryNotes": DeliveryNotes,
    "Fixings": Fixings,
    "FullStockTake": FullStockTake,
    "Operations": Operations,
    "PartialStockTake": PartialStockTake,
    "PinVerification": PinVerification,
    "ProjectDetail": ProjectDetail,
    "Projects": Projects,
    "Reports": Reports,
    "Requirements": Requirements,
    "Sections": Sections,
    "SetupPin": SetupPin,
    "FullStockTakeReport": FullStockTakeReport,
    "Dashboard": Dashboard,
    "MyWIP": MyWIP,
    "Scan": Scan,
    "Parts": Parts,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};