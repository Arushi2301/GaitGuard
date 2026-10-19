export type ThemeColors = {
  bg: string;          
  surface: string;     
  text: string;
  muted: string;
  border: string;
  primary: string;     
  onPrimary: string;   
  tabBar: string;      
  onTabBar: string;
  danger: string;
  // pastel cards (inspo style)
  pink: string;
  mint: string;
  yellow: string;
  lavender: string;
  peach: string;
  onPastel: string;    
};

export const lightColors: ThemeColors = {
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  text: '#1B1B1F',
  muted: '#6B6B76',
  border: '#ECE8E3',
  primary: '#2F8F83',
  onPrimary: '#FFFFFF',
  tabBar: '#1F1F24',
  onTabBar: '#FFFFFF',
  danger: '#E5484D',
  pink: '#F8C8D4',
  mint: '#BFE6DC',
  yellow: '#F9E08B',
  lavender: '#D9D3F5',
  peach: '#FBD3B5',
  onPastel: '#1B1B1F',
};

export const darkColors: ThemeColors = {
  bg: '#121318',
  surface: '#1C1E25',
  text: '#F2F2F5',
  muted: '#9A9AA6',
  border: '#2A2C35',
  primary: '#5CC4B5',
  onPrimary: '#0F1A18',
  tabBar: '#2A2C35',
  onTabBar: '#FFFFFF',
  danger: '#FF6B6E',
  pink: '#E7B3C0',
  mint: '#A6D4C8',
  yellow: '#E8CF7A',
  lavender: '#C3BCE6',
  peach: '#E9BE9E',
  onPastel: '#1B1B1F',
};

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };