import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Design Library</h1>
      <p className="text-gray-500">
        Internal design library — 3D products, projects &amp; feedback.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
      >
        Sign in
      </Link>
    </main>
  );
}
