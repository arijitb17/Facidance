"use client";

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
}

export default function DataTable<T extends { id: string }>({
  data,
  columns,
}: Props<T>) {
  return (
    <div className="overflow-x-auto bg-white border rounded-2xl shadow">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="px-4 py-3 text-left">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-t hover:bg-slate-50">
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3">
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}