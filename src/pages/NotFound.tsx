import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl sm:text-4xl">Page not found</h1>
      <p className="bx-prose mt-2">That address does not match a page of this app.</p>
      <p className="mt-4"><Link className="bx-btn-primary" to="/">Home</Link> <Link className="bx-btn ml-2" to="/read">Reader</Link> <Link className="bx-btn ml-2" to="/compounds">Compounds</Link></p>
    </div>
  );
}
