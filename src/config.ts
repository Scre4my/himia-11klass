const { hostname } = window.location;
export const API_URL = process.env.REACT_APP_API_URL || `http://${hostname}:5001`;
