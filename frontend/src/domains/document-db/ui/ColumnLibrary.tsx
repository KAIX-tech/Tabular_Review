"use client";

import type { ColumnType } from "@/domains/document-review";
import {
  Calendar,
  CheckSquare,
  Download,
  Hash,
  Library,
  List,
  Loader2,
  Search,
  Trash2,
  Type,
  Upload,
  X,
} from "@/shared/ui/icons";
import type React from "react";
import { useState } from "react";
import {
  useColumnTemplates,
  useDeleteColumnTemplate,
  useImportColumnTemplates,
} from "../api/column-templates.hooks";
import { exportTemplatesToFile, pickTemplatesFromFile } from "../lib/column-template-file";
import type { ColumnTemplate } from "../model/types";

interface ColumnLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ColumnTemplate) => void;
}

const TYPE_ICONS: Record<ColumnType, React.FC<{ className?: string }>> = {
  text: Type,
  number: Hash,
  date: Calendar,
  boolean: CheckSquare,
  list: List,
};

const TYPE_COLORS: Record<ColumnType, string> = {
  text: "bg-blue-100 text-blue-700",
  number: "bg-emerald-100 text-emerald-700",
  date: "bg-purple-100 text-purple-700",
  boolean: "bg-amber-100 text-amber-700",
  list: "bg-pink-100 text-pink-700",
};

export const ColumnLibrary: React.FC<ColumnLibraryProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  // Server-backed (global, firm-wide). Fetch only while the modal is open.
  const { data: templates = [], isLoading } = useColumnTemplates();
  const deleteTemplate = useDeleteColumnTemplate();
  const importTemplates = useImportColumnTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    ...new Set(templates.map((t) => t.category).filter((c): c is string => !!c)),
  ].sort();

  const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this template from your library?")) {
      deleteTemplate.mutate(templateId);
    }
  };

  const handleExportLibrary = async () => {
    try {
      await exportTemplatesToFile(templates);
    } catch (error) {
      console.error("Failed to export library:", error);
      alert("Failed to export library.");
    }
  };

  const handleImportLibrary = async () => {
    try {
      const imported = await pickTemplatesFromFile();
      if (imported && imported.length > 0) {
        importTemplates.mutate(imported.map((t) => ({ ...t })));
      }
    } catch (error) {
      console.error("Failed to import library:", error);
      alert("Failed to import library. The file may be invalid.");
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-10 lg:inset-20 bg-white rounded-2xl shadow-2xl z-50 flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Library className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Column Library</h2>
              <p className="text-sm text-slate-500">{templates.length} saved templates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportLibrary}
              className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all"
              title="Import Library"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <button
              onClick={handleExportLibrary}
              className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md transition-all"
              title="Export Library"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  selectedCategory === null
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    selectedCategory === cat
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-100 rounded-full mb-4">
                <Library className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                {templates.length === 0 ? "No templates yet" : "No matching templates"}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                {templates.length === 0
                  ? "Save columns to your library when creating or editing them to reuse across projects."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const TypeIcon = TYPE_ICONS[template.type];
                return (
                  <div
                    key={template.id}
                    onClick={() => onSelectTemplate(template)}
                    className="group p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-white"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${TYPE_COLORS[template.type]}`}>
                          <TypeIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-slate-800">{template.name}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-all"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{template.prompt}</p>

                    <div className="flex items-center justify-between">
                      {template.category && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          {template.category}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-500 text-center">
            Click a template to add it as a new column in your project
          </p>
        </div>
      </div>
    </>
  );
};
