import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#FFB74D', // pasztell narancs
      contrastText: '#4E260E',
    },
    secondary: {
      main: '#FFD54F', // pasztell sárga
      contrastText: '#4E260E',
    },
    background: {
      default: '#FFFDF7', // törtfehér
      paper: '#FFF9EC', // világos sárgás háttér
    },
    text: {
      primary: '#4E260E', // sötétbarna
      secondary: '#A67C52', // világosabb barna
    },
    divider: '#FFE0B2',
    info: {
      main: '#FFECB3',
    },
    success: {
      main: '#AED581',
    },
    error: {
      main: '#FF7043',
    },
    warning: {
      main: '#FFB300',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      'Roboto',
      'Segoe UI',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(','),
    fontSize: 13,
    h5: {
      fontWeight: 600,
      fontSize: '1.1rem',
      letterSpacing: 0.2,
    },
    body2: {
      fontSize: '0.95rem',
    },
    button: {
      fontWeight: 500,
      fontSize: '0.95rem',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          boxShadow: 'none',
          fontWeight: 500,
        },
        contained: {
          background: 'linear-gradient(90deg, #FFD54F 0%, #FFB74D 100%)',
          color: '#4E260E',
        },
        outlined: {
          borderColor: '#FFECB3',
          color: '#4E260E',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFF9EC',
          borderRadius: 14,
          boxShadow: '0 2px 8px 0 rgba(255, 183, 77, 0.08)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.95rem',
          padding: '8px 12px',
          borderBottom: '1px solid #FFE0B2',
        },
        head: {
          backgroundColor: '#FFF3E0',
          color: '#4E260E',
          fontWeight: 600,
          fontSize: '1rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#FFF8E1',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFE0B2',
          color: '#4E260E',
          fontWeight: 500,
          fontSize: '0.85rem',
          borderRadius: 6,
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          minHeight: 32,
          fontSize: '0.95rem',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '0.95rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: '0.95rem',
        },
      },
    },
  },
}); 