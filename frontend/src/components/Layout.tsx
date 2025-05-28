import { ReactNode, createContext, useContext, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  BugReport as BugReportIcon,
  Description as DescriptionIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Casino as CasinoIcon,
  Assessment as AssessmentIcon, // Added icon
} from '@mui/icons-material';
import { useJira } from '../contexts/JiraContext';
import { useQueue } from '../contexts/QueueContext';

interface LayoutProps {
  children: ReactNode;
}

interface SelectedTicketsContextType {
  selectedTickets: Set<string>;
  setSelectedTickets: (tickets: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

export const SelectedTicketsContext = createContext<SelectedTicketsContextType>({
  selectedTickets: new Set(),
  setSelectedTickets: () => {},
});

export const useSelectedTickets = () => useContext(SelectedTicketsContext);

const drawerWidth = 240;
const collapsedDrawerWidth = 65;

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const { tickets } = useJira();
  const { queue, addToQueue } = useQueue();

  const menuItems = [
    { text: 'JIRA Tickets', icon: <BugReportIcon />, path: '/' },
    { 
      text: 'PBR Planning', 
      icon: (
        <Badge badgeContent={queue.length} color="primary">
          <DescriptionIcon />
        </Badge>
      ), 
      path: '/pbr' 
    },
    { text: 'Planning Poker', icon: <CasinoIcon />, path: '/poker' },
    { text: 'Retro Presentation', icon: <AssessmentIcon />, path: '/retro-presentation' }, // Added menu item
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerCollapse = () => {
    setIsDrawerCollapsed(!isDrawerCollapsed);
  };

  const handleAddToPBRQueue = () => {
    const selectedTicketsList = tickets.filter(ticket => selectedTickets.has(ticket.key));
    addToQueue(selectedTicketsList);
    setSelectedTickets(new Set()); // Clear selection after adding to queue
  };

  const drawer = (
    <div>
      <Toolbar sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: isDrawerCollapsed ? 'center' : 'flex-end',
        px: [1],
      }}>
        {isDrawerCollapsed ? (
          <IconButton onClick={handleDrawerCollapse}>
            <ChevronRightIcon />
          </IconButton>
        ) : (
          <IconButton onClick={handleDrawerCollapse}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <Tooltip 
            title={isDrawerCollapsed ? item.text : ''} 
            placement="right"
            key={item.text}
          >
            <ListItem
              button
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              selected={location.pathname === item.path}
              sx={{
                minHeight: 48,
                justifyContent: isDrawerCollapsed ? 'center' : 'initial',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isDrawerCollapsed ? 'auto' : 3,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!isDrawerCollapsed && <ListItemText primary={item.text} />}
            </ListItem>
          </Tooltip>
        ))}
      </List>
    </div>
  );

  return (
    <SelectedTicketsContext.Provider value={{ selectedTickets, setSelectedTickets }}>
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            width: { sm: `calc(100% - ${isDrawerCollapsed ? collapsedDrawerWidth : drawerWidth}px)` },
            ml: { sm: `${isDrawerCollapsed ? collapsedDrawerWidth : drawerWidth}px` },
            transition: 'width 0.2s, margin-left 0.2s',
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Automatic Poll Generator
            </Typography>
            {location.pathname === '/' && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleAddToPBRQueue}
                disabled={selectedTickets.size === 0}
                sx={{ ml: 2 }}
              >
                Add to PBR Queue ({selectedTickets.size})
              </Button>
            )}
          </Toolbar>
        </AppBar>
        <Box
          component="nav"
          sx={{ 
            width: { sm: isDrawerCollapsed ? collapsedDrawerWidth : drawerWidth }, 
            flexShrink: { sm: 0 },
            transition: 'width 0.2s',
          }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
              },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: isDrawerCollapsed ? collapsedDrawerWidth : drawerWidth,
                transition: 'width 0.2s',
                overflowX: 'hidden',
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${isDrawerCollapsed ? collapsedDrawerWidth : drawerWidth}px)` },
            transition: 'width 0.2s, margin-left 0.2s',
          }}
        >
          <Toolbar />
          {children}
        </Box>
      </Box>
    </SelectedTicketsContext.Provider>
  );
} 