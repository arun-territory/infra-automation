// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';

function App() {
  const [formData, setFormData] = useState({
    projectId: '',
    region: '',
    clusterName: '',
    nodeCount: 3,
    serviceAccount: 'githubactions-sa@turnkey-guild-441104-f3.iam.gserviceaccount.com' // Service account email
});

  const [deployments, setDeployments] = useState([]);

  useEffect(() => {
    fetchDeployments();
  }, []);

  const fetchDeployments = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/deployments`);
      setDeployments(response.data);
    } catch (error) {
      console.error('Error fetching deployments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      toast.loading('Initiating deployment...');
      await axios.post(`${process.env.REACT_APP_API_URL}/api/deploy`, formData);
      toast.success('Deployment initiated successfully!');
      fetchDeployments();
      
      // Reset form
      setFormData({
        projectId: '',
        region: '',
        clusterName: '',
        nodeCount: 3,
        serviceAccountKey: ''
      });
    } catch (error) {
      console.error('Deployment error:', error);
      toast.error('Failed to initiate deployment');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-2xl font-bold mb-8">Deploy GKE Cluster</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Project ID</label>
                    <input
                      type="text"
                      name="projectId"
                      value={formData.projectId}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Region</label>
                    <input
                      type="text"
                      name="region"
                      value={formData.region}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cluster Name</label>
                    <input
                      type="text"
                      name="clusterName"
                      value={formData.clusterName}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Node Count</label>
                    <input
                      type="number"
                      name="nodeCount"
                      value={formData.nodeCount}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Service Account Key</label>
                    <textarea
                      name="serviceAccountKey"
                      value={formData.serviceAccountKey}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      rows="4"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Deploy Infrastructure
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Deployments List */}
      <div className="mt-8 max-w-4xl mx-auto px-4">
        <h3 className="text-xl font-semibold mb-4">Recent Deployments</h3>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {deployments.map((deployment) => (
              <li key={deployment.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Cluster: {deployment.cluster_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Project: {deployment.project_id} | Region: {deployment.region}
                    </p>
                  </div>
                  <div>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${deployment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        deployment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {deployment.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <Toaster position="top-right" />
    </div>
  );
}

export default App;