import { Link } from "react-router-dom";
import { Instagram, Facebook, Twitter } from "lucide-react";
import vivygoldLogo from "@/assets/vivygold-logo.jpg";

export const Footer = () => {
  return (
    <footer className="border-t border-border mt-32 bg-card/30">
      <div className="container py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          <div className="col-span-2 md:col-span-1">
            <img src={vivygoldLogo} alt="Vivygold Exceptional Store" className="h-20 w-auto object-contain mb-6 -ml-2" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Crafted for the woman who refuses ordinary. Premium raw hair, uncompromising quality.
            </p>
            <div className="flex gap-3 mt-6">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="size-9 grid place-items-center border border-border rounded-full hover:border-primary hover:text-primary transition-colors">
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-primary mb-5">Shop</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/shop?cat=wigs" className="hover:text-primary">Wigs</Link></li>
              <li><Link to="/shop?cat=bundles" className="hover:text-primary">Bundles</Link></li>
              <li><Link to="/shop?cat=closures" className="hover:text-primary">Closures</Link></li>
              <li><Link to="/shop?cat=frontals" className="hover:text-primary">Frontals</Link></li>
              <li><Link to="/shop?cat=braids" className="hover:text-primary">Braids</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-primary mb-5">Help</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary">About Vivygold</Link></li>
              <li><a href="#" className="hover:text-primary">Shipping</a></li>
              <li><a href="#" className="hover:text-primary">Returns</a></li>
              <li><a href="#" className="hover:text-primary">Pay Small Small</a></li>
              <li><a href="#" className="hover:text-primary">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] text-primary mb-5">Newsletter</h4>
            <p className="text-sm text-muted-foreground mb-4">First access to drops & private sales.</p>
            <form className="flex border border-border rounded-sm overflow-hidden">
              <input
                type="email"
                placeholder="Email"
                className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <button className="bg-gold text-primary-foreground px-4 text-xs uppercase tracking-widest">Join</button>
            </form>
          </div>
        </div>

        <div className="gold-divider my-12" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Vivygold. All rights reserved.</p>
          <p className="tracking-widest uppercase">Crafted with gold ✦ in Lagos</p>
        </div>
      </div>
    </footer>
  );
};
