import { redirect } from 'next/navigation';

export default function CostingPage() {
  redirect('/reports?report=COGS');
}
