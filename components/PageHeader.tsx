import { type ReactNode } from "react";

interface Props {
  title: string;
  action?: ReactNode;
}

export default function PageHeader({ title, action }: Props) {
  return (
    <div className="w-full border-b border-gray-200 bg-gray-50 md:border-none md:bg-transparent md:mt-8 md:mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 py-4 md:py-0 md:text-3xl md:font-bold">
          {title}
        </h1>
        {action}
      </div>
    </div>
  );
}
