/**
 * New project page
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectForm } from '../components/projects/ProjectForm';

export const NewProjectPage: React.FC = () => {
  return (
    <div>
      <div className="mb-6">
        <Link
          to="/projects"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
        <p className="mt-1 text-sm text-gray-600">
          Set up a new project/job with default OH&P percentages
        </p>
      </div>

      <ProjectForm />
    </div>
  );
};
