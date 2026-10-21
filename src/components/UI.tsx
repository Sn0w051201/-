import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowRight, Compass, Plus, X } from 'lucide-react';
import type { Member } from '../domain/types';
export function Button({children,variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'orange';children:ReactNode}){return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;}
export function IconButton({label,children,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){return <button className={`icon-btn ${className}`} title={label} aria-label={label} {...props}>{children}</button>;}
export function PageHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:ReactNode}){return <div className="page-heading"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;}
export function SectionTitle({title,note,action}:{title:string;note?:string;action?:ReactNode}){return <div className="section-title"><div><h2>{title}</h2>{note&&<p>{note}</p>}</div>{action}</div>;}
export function Avatar({member,size='normal'}:{member:Pick<Member,'name'|'color'>;size?:'normal'|'small'|'large'}){return <span title={member.name} className={`avatar avatar-${size}`} style={{background:member.color}}>{member.name.slice(-1)}</span>;}
export function AvatarStack({members}:{members:Member[]}){return <span className="avatar-stack">{members.slice(0,4).map(m=><Avatar member={m} size="small" key={m.id}/>)}<span className="avatar-number">{members.length} 位旅伴</span></span>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Empty({title,description,action}:{title:string;description:string;action?:ReactNode}){return <div className="empty"><span className="empty-icon"><Compass size={30}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function Modal({title,description,onClose,children}:{title:string;description?:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();const cancel=(e:Event)=>{e.preventDefault();closeRef.current();};dialog.addEventListener('cancel',cancel);return()=>{dialog.removeEventListener('cancel',cancel);dialog.close();};},[]);
  return <dialog ref={ref} className="modal" onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={title}><div className="modal-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><IconButton label="关闭窗口" onClick={onClose}><X size={20}/></IconButton></div>{children}</dialog>;
}
export const AddButton=({children,onClick}:{children:ReactNode;onClick:()=>void})=><Button onClick={onClick}><Plus size={17}/>{children}</Button>;
export const TextLink=({children,onClick}:{children:ReactNode;onClick:()=>void})=><button className="text-link" onClick={onClick}>{children}<ArrowRight size={15}/></button>;
