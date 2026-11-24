use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use ephemeral_rollups_sdk::{
    access_control::{
        instructions::CreateEphemeralPermissionCpi,
        structs::{EphemeralMembersArgs, EphemeralPermission, Member, TX_LOGS_FLAG},
    },
    anchor::{commit, delegate, ephemeral, vrf},
    consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
    vrf::{
        consts::{program_identity_pubkey, scoped_vrf_identity_const, DEFAULT_QUEUE},
        instructions::{create_request_high_priority_scoped_randomness_ix_const, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

declare_id!("BrQHcYwehSANxdTCvRKhdHwR6PybaX1YSLUpbQ2NcDqZ");
const TEE: Pubkey = pubkey!("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo");
const UNSET: u8 = 255;
const OPEN: u8 = 0;
const STAKED: u8 = 1;
const ROLLING: u8 = 2;
const SETTLED: u8 = 3;
const REFUNDED: u8 = 4;
const DUEL_TIMEOUT: i64 = 30 * 60;
const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&ID);
const VRF_CALLBACK_IDENTITY: Pubkey = Pubkey::new_from_array(scoped_vrf_identity_const(&ID).0);

#[ephemeral]
#[program]
pub mod demon_duels {
    use super::*;

    pub fn request_pack(ctx: Context<RequestPack>) -> Result<()> {
        let owner = ctx.accounts.payer.key();
        let pack = &mut ctx.accounts.pack;
        pack.owner = owner;
        for card in [&mut ctx.accounts.card0, &mut ctx.accounts.card1, &mut ctx.accounts.card2] {
            card.owner = owner;
            card.kind = UNSET;
        }
        let ix = request_ix(
            owner, ctx.accounts.oracle_queue.key(), pack.key(),
            instruction::FulfillPack::DISCRIMINATOR,
            [pack.key(), ctx.accounts.card0.key(), ctx.accounts.card1.key(), ctx.accounts.card2.key()],
        );
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn fulfill_pack(ctx: Context<FulfillPack>, randomness: [u8; 32]) -> Result<()> {
        require!(!ctx.accounts.pack.opened, ArenaError::WrongPhase);
        let shift = randomness[0] % 6;
        let other = (shift + 1 + randomness[1] % 5) % 6;
        let mut third = randomness[2] % 4;
        for kind in 0..6 {
            if kind != shift && kind != other {
                if third == 0 {
                    third = kind;
                    break;
                }
                third -= 1;
            }
        }
        ctx.accounts.card0.kind = shift;
        ctx.accounts.card1.kind = other;
        ctx.accounts.card2.kind = third;
        ctx.accounts.pack.opened = true;
        msg!("Starter pack opened: {}, {}, {}", shift, other, third);
        Ok(())
    }

    pub fn open_duel(ctx: Context<OpenDuel>, nonce: u64) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        let card = &mut ctx.accounts.card;
        require_available(card, ctx.accounts.payer.key())?;
        card.lock = duel.key();
        duel.nonce = nonce;
        duel.p1 = ctx.accounts.payer.key();
        duel.card1 = card.key();
        duel.deadline = Clock::get()?.unix_timestamp + DUEL_TIMEOUT;
        duel.moves = [UNSET; 2];
        Ok(())
    }

    pub fn join_duel(ctx: Context<JoinDuel>) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        let payer = ctx.accounts.payer.key();
        require!(duel.phase == OPEN && Clock::get()?.unix_timestamp < duel.deadline, ArenaError::WrongPhase);
        require_keys_neq!(duel.p1, payer, ArenaError::NotPlayer);
        require_available(&ctx.accounts.card, payer)?;
        ctx.accounts.card.lock = duel.key();
        duel.p2 = payer;
        duel.card2 = ctx.accounts.card.key();
        duel.phase = STAKED;
        duel.deadline = Clock::get()?.unix_timestamp + DUEL_TIMEOUT;

        let round = &mut ctx.accounts.round;
        round.duel = duel.key();
        round.players = [duel.p1, duel.p2];
        round.moves = [UNSET; 2];
        for (pick, player) in [(&mut ctx.accounts.pick1, duel.p1), (&mut ctx.accounts.pick2, duel.p2)] {
            pick.duel = duel.key();
            pick.player = player;
            pick.choice = UNSET;
            transfer(
                CpiContext::new(ctx.accounts.system_program.key(), Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: pick.to_account_info(),
                }),
                ephemeral_rollups_sdk::ephemeral_accounts::rent(EphemeralPermission::size_of(1) as u32),
            )?;
        }
        Ok(())
    }

    pub fn delegate_round(ctx: Context<DelegateRound>, which: u8) -> Result<()> {
        let duel = &ctx.accounts.duel;
        require!(duel.phase == STAKED, ArenaError::WrongPhase);
        require!(ctx.accounts.payer.key() == duel.p1 || ctx.accounts.payer.key() == duel.p2, ArenaError::NotPlayer);
        let room = duel.key();
        let seeds: &[&[u8]] = match which {
            0 => &[b"round", room.as_ref()],
            1 => &[b"pick", room.as_ref(), duel.p1.as_ref()],
            2 => &[b"pick", room.as_ref(), duel.p2.as_ref()],
            _ => return err!(ArenaError::BadMove),
        };
        require_keys_eq!(Pubkey::find_program_address(seeds, &ID).0, ctx.accounts.pda.key(), ArenaError::WrongAccount);
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer, seeds, DelegateConfig { validator: Some(TEE), ..Default::default() },
        )?;
        Ok(())
    }

    pub fn protect_pick(ctx: Context<ProtectPick>) -> Result<()> {
        if ctx.accounts.permission.owner == &PERMISSION_PROGRAM_ID {
            return Ok(());
        }
        let pick = &ctx.accounts.pick;
        CreateEphemeralPermissionCpi {
            payer: pick.to_account_info(),
            permissioned_account: pick.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private: true,
                members: vec![Member { pubkey: pick.player, flags: TX_LOGS_FLAG }],
            },
        }
        .invoke_signed(&[&[b"pick", pick.duel.as_ref(), pick.player.as_ref(), &[ctx.bumps.pick]]])?;
        Ok(())
    }

    pub fn lock_move(ctx: Context<LockMove>, choice: u8) -> Result<()> {
        require!(choice < 3, ArenaError::BadMove);
        let pick = &mut ctx.accounts.pick;
        require!(pick.choice == UNSET, ArenaError::AlreadyLocked);
        let data = ctx.accounts.permission.try_borrow_data()?;
        let permission = EphemeralPermission::from_bytes(&data)?;
        require!(permission.private && permission.permissioned_account == pick.key(), ArenaError::MissingPrivacy);
        pick.choice = choice;
        Ok(())
    }

    pub fn reveal_moves(ctx: Context<RevealMoves>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        require!(round.moves == [UNSET; 2], ArenaError::WrongPhase);
        require!(ctx.accounts.pick1.choice < 3 && ctx.accounts.pick2.choice < 3, ArenaError::MoveMissing);
        round.moves = [ctx.accounts.pick1.choice, ctx.accounts.pick2.choice];
        Ok(())
    }

    pub fn commit_round(ctx: Context<CommitRound>) -> Result<()> {
        let round = &ctx.accounts.round;
        require!(round.moves[0] < 3 && round.moves[1] < 3, ArenaError::MoveMissing);
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[round.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    pub fn request_outcome(ctx: Context<RequestOutcome>) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        require!(duel.phase == STAKED && Clock::get()?.unix_timestamp < duel.deadline, ArenaError::WrongPhase);
        let moves = ctx.accounts.round.moves;
        require!(moves[0] < 3 && moves[1] < 3, ArenaError::MoveMissing);
        duel.moves = moves;
        duel.phase = ROLLING;
        let ix = request_ix(
            ctx.accounts.payer.key(), ctx.accounts.oracle_queue.key(), duel.key(),
            instruction::FulfillOutcome::DISCRIMINATOR,
            [duel.key(), duel.card1, duel.card2],
        );
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn fulfill_outcome(ctx: Context<FulfillOutcome>, randomness: [u8; 32]) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        require!(duel.phase == ROLLING, ArenaError::WrongPhase);
        require_keys_eq!(ctx.accounts.card1.lock, duel.key(), ArenaError::WrongAccount);
        require_keys_eq!(ctx.accounts.card2.lock, duel.key(), ArenaError::WrongAccount);
        let (winner, crits, scores) = score(duel.moves, randomness);
        duel.winner = if winner == 0 { duel.p1 } else { duel.p2 };
        duel.crits = crits;
        duel.scores = scores;
        duel.phase = SETTLED;
        for card in [&mut ctx.accounts.card1, &mut ctx.accounts.card2] {
            card.owner = duel.winner;
            card.lock = Pubkey::default();
        }
        emit!(DuelSettled { duel: duel.key(), winner: duel.winner, cards: [duel.card1, duel.card2], scores, crits });
        msg!("Demon Duels: winner {} now owns both cards", duel.winner);
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let duel = &mut ctx.accounts.duel;
        require!(duel.phase <= ROLLING, ArenaError::WrongPhase);
        require!(ctx.accounts.payer.key() == duel.p1 || ctx.accounts.payer.key() == duel.p2, ArenaError::NotPlayer);
        require!(duel.phase == OPEN || Clock::get()?.unix_timestamp >= duel.deadline, ArenaError::WrongPhase);
        if duel.phase != OPEN {
            let other = ctx.accounts.card2.as_mut().ok_or(ArenaError::WrongAccount)?;
            require_keys_eq!(other.key(), duel.card2, ArenaError::WrongAccount);
            require_keys_eq!(other.lock, duel.key(), ArenaError::WrongAccount);
            other.lock = Pubkey::default();
        }
        require_keys_eq!(ctx.accounts.card1.lock, duel.key(), ArenaError::WrongAccount);
        ctx.accounts.card1.lock = Pubkey::default();
        duel.phase = REFUNDED;
        Ok(())
    }
}

fn require_available(card: &Card, owner: Pubkey) -> Result<()> {
    require_keys_eq!(card.owner, owner, ArenaError::NotPlayer);
    require!(card.lock == Pubkey::default() && card.kind < 6, ArenaError::CardUnavailable);
    Ok(())
}

fn request_ix<const N: usize>(
    payer: Pubkey, oracle_queue: Pubkey, seed: Pubkey, discriminator: &[u8], accounts: [Pubkey; N],
) -> anchor_lang::solana_program::instruction::Instruction {
    create_request_high_priority_scoped_randomness_ix_const(RequestRandomnessParams {
        payer,
        oracle_queue,
        callback_program_id: ID,
        callback_discriminator: discriminator.to_vec(),
        caller_seed: seed.to_bytes(),
        accounts_metas: Some(accounts.into_iter().map(|pubkey| SerializableAccountMeta {
            pubkey, is_signer: false, is_writable: true,
        }).collect()),
        ..Default::default()
    }, PROGRAM_IDENTITY)
}

fn score(moves: [u8; 2], randomness: [u8; 32]) -> (usize, [bool; 2], [u8; 2]) {
    let crits = [randomness[0] < 64, randomness[1] < 64];
    let scores = [
        2 + u8::from((moves[0] + 1) % 3 == moves[1]) + 2 * u8::from(crits[0]),
        2 + u8::from((moves[1] + 1) % 3 == moves[0]) + 2 * u8::from(crits[1]),
    ];
    let winner = match scores[0].cmp(&scores[1]) {
        std::cmp::Ordering::Greater => 0,
        std::cmp::Ordering::Less => 1,
        std::cmp::Ordering::Equal => usize::from(randomness[2] & 1),
    };
    (winner, crits, scores)
}

#[vrf]
#[derive(Accounts)]
pub struct RequestPack<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, space = 8 + Pack::INIT_SPACE, seeds = [b"pack", payer.key().as_ref()], bump)]
    pub pack: Account<'info, Pack>,
    #[account(init, payer = payer, space = 8 + Card::INIT_SPACE, seeds = [b"card", payer.key().as_ref(), &[0]], bump)]
    pub card0: Account<'info, Card>,
    #[account(init, payer = payer, space = 8 + Card::INIT_SPACE, seeds = [b"card", payer.key().as_ref(), &[1]], bump)]
    pub card1: Account<'info, Card>,
    #[account(init, payer = payer, space = 8 + Card::INIT_SPACE, seeds = [b"card", payer.key().as_ref(), &[2]], bump)]
    pub card2: Account<'info, Card>,
    /// CHECK: MagicBlock's canonical devnet queue.
    #[account(mut, address = DEFAULT_QUEUE)]
    pub oracle_queue: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FulfillPack<'info> {
    #[account(address = VRF_CALLBACK_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut, seeds = [b"pack", pack.owner.as_ref()], bump)]
    pub pack: Account<'info, Pack>,
    #[account(mut, seeds = [b"card", pack.owner.as_ref(), &[0]], bump)]
    pub card0: Account<'info, Card>,
    #[account(mut, seeds = [b"card", pack.owner.as_ref(), &[1]], bump)]
    pub card1: Account<'info, Card>,
    #[account(mut, seeds = [b"card", pack.owner.as_ref(), &[2]], bump)]
    pub card2: Account<'info, Card>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct OpenDuel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, space = 8 + Duel::INIT_SPACE, seeds = [b"duel", payer.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub duel: Account<'info, Duel>,
    #[account(mut)]
    pub card: Account<'info, Card>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub duel: Account<'info, Duel>,
    #[account(mut)]
    pub card: Account<'info, Card>,
    #[account(init, payer = payer, space = 8 + Round::INIT_SPACE, seeds = [b"round", duel.key().as_ref()], bump)]
    pub round: Account<'info, Round>,
    #[account(init, payer = payer, space = 8 + Pick::INIT_SPACE, seeds = [b"pick", duel.key().as_ref(), duel.p1.as_ref()], bump)]
    pub pick1: Account<'info, Pick>,
    #[account(init, payer = payer, space = 8 + Pick::INIT_SPACE, seeds = [b"pick", duel.key().as_ref(), payer.key().as_ref()], bump)]
    pub pick2: Account<'info, Pick>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateRound<'info> {
    /// CHECK: The handler verifies the exact duel-derived PDA before delegation.
    #[account(mut, del)]
    pub pda: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub duel: Account<'info, Duel>,
    /// CHECK: Only the confidential devnet validator can receive this PDA.
    #[account(address = TEE)]
    pub validator: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ProtectPick<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"pick", pick.duel.as_ref(), payer.key().as_ref()], bump, constraint = pick.player == payer.key())]
    pub pick: Account<'info, Pick>,
    /// CHECK: Created by MagicBlock for the exact pick.
    #[account(mut, address = EphemeralPermission::find_pda(&pick.key()).0)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Fixed MagicBlock program.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: Fixed MagicBlock rent vault.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Fixed MagicBlock program.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct LockMove<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"pick", pick.duel.as_ref(), payer.key().as_ref()], bump, constraint = pick.player == payer.key())]
    pub pick: Account<'info, Pick>,
    /// CHECK: Validated as the private MagicBlock ACL in the handler.
    #[account(address = EphemeralPermission::find_pda(&pick.key()).0, owner = PERMISSION_PROGRAM_ID)]
    pub permission: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RevealMoves<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, constraint = round.players.contains(&payer.key()))]
    pub round: Account<'info, Round>,
    #[account(seeds = [b"pick", round.duel.as_ref(), round.players[0].as_ref()], bump)]
    pub pick1: Account<'info, Pick>,
    #[account(seeds = [b"pick", round.duel.as_ref(), round.players[1].as_ref()], bump)]
    pub pick2: Account<'info, Pick>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, constraint = round.players.contains(&payer.key()))]
    pub round: Account<'info, Round>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestOutcome<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, constraint = duel.p1 == payer.key() || duel.p2 == payer.key())]
    pub duel: Account<'info, Duel>,
    #[account(seeds = [b"round", duel.key().as_ref()], bump)]
    pub round: Account<'info, Round>,
    /// CHECK: MagicBlock's canonical devnet queue.
    #[account(mut, address = DEFAULT_QUEUE)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct FulfillOutcome<'info> {
    #[account(address = VRF_CALLBACK_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub duel: Account<'info, Duel>,
    #[account(mut, address = duel.card1)]
    pub card1: Account<'info, Card>,
    #[account(mut, address = duel.card2)]
    pub card2: Account<'info, Card>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    pub payer: Signer<'info>,
    #[account(mut)]
    pub duel: Account<'info, Duel>,
    #[account(mut, address = duel.card1)]
    pub card1: Account<'info, Card>,
    #[account(mut)]
    pub card2: Option<Account<'info, Card>>,
}

#[account]
#[derive(InitSpace)]
pub struct Card {
    pub owner: Pubkey,
    pub lock: Pubkey,
    pub kind: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Pack {
    pub owner: Pubkey,
    pub opened: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Duel {
    pub nonce: u64,
    pub p1: Pubkey,
    pub p2: Pubkey,
    pub card1: Pubkey,
    pub card2: Pubkey,
    pub winner: Pubkey,
    pub deadline: i64,
    pub phase: u8,
    pub moves: [u8; 2],
    pub crits: [bool; 2],
    pub scores: [u8; 2],
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub duel: Pubkey,
    pub players: [Pubkey; 2],
    pub moves: [u8; 2],
}

#[account]
#[derive(InitSpace)]
pub struct Pick {
    pub duel: Pubkey,
    pub player: Pubkey,
    pub choice: u8,
}

#[event]
pub struct DuelSettled {
    pub duel: Pubkey,
    pub winner: Pubkey,
    pub cards: [Pubkey; 2],
    pub scores: [u8; 2],
    pub crits: [bool; 2],
}

#[error_code]
pub enum ArenaError {
    #[msg("This action is not available in the current phase.")]
    WrongPhase,
    #[msg("Only a participant or the card owner can do this.")]
    NotPlayer,
    #[msg("This card is pending or already staked.")]
    CardUnavailable,
    #[msg("Unknown move.")]
    BadMove,
    #[msg("Unexpected account for this duel.")]
    WrongAccount,
    #[msg("Move already locked.")]
    AlreadyLocked,
    #[msg("Both players must lock a move first.")]
    MoveMissing,
    #[msg("The move must have a private ACL before submission.")]
    MissingPrivacy,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tactical_advantage_beats_an_equal_crit_roll() {
        for choice in 0..3 {
            let opponent = (choice + 1) % 3;
            assert_eq!(score([choice, opponent], [255; 32]), (0, [false; 2], [3, 2]));
            assert_eq!(score([opponent, choice], [0; 32]), (1, [true; 2], [4, 5]));
        }
    }

    #[test]
    fn a_critical_can_flip_the_duel() {
        let mut rng = [255; 32];
        rng[1] = 0;
        assert_eq!(score([0, 1], rng), (1, [false, true], [3, 4]));
    }

    #[test]
    fn equal_moves_and_crits_use_oracle_tiebreak() {
        assert_eq!(score([2, 2], [0; 32]).0, 0);
        assert_eq!(score([2, 2], [1; 32]).0, 1);
    }
}
