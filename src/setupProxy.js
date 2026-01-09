const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // IMPORTANT: Proxy /forms routes BEFORE React Router handles them
  // This ensures form endpoints work from anywhere (like Getform.io)
  app.use('/forms', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  }));
  
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
  }));
};

