/**
 * Core API client for making HTTP requests to the backend
 */

export const api = {
  /**
   * Make an API call
   * @param {string} endpoint - API endpoint (e.g., '/timesheets')
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Response data
   */
  async call(endpoint, options = {}) {
    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} - Response data
   */
  get(endpoint) {
    return this.call(endpoint);
  },

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @returns {Promise<Object>} - Response data
   */
  post(endpoint, body) {
    return this.call(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @returns {Promise<Object>} - Response data
   */
  put(endpoint, body) {
    return this.call(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} - Response data
   */
  delete(endpoint) {
    return this.call(endpoint, {
      method: 'DELETE'
    });
  }
};
